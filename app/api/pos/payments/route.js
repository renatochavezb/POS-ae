import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import PosPayment from "@/models/PosPayment";
import PosAppointment from "@/models/PosAppointment";
import PosCashTicket from "@/models/PosCashTicket";
import PosClient from "@/models/PosClient";
import PosStaff from "@/models/PosStaff";
import PosReceptionist from "@/models/PosReceptionist";
import { mapAppointmentDoc, mapPaymentDoc } from "@/libs/posMappers";
import {
  getOpenCashSession,
  getPaymentsForDate,
  getPaymentsForSession,
  PAYMENT_METHODS,
  refreshCashSessionTotals,
  resolvePaymentBreakdown,
  summarizePayments,
} from "@/libs/posCashRegister";
import { upsertDailySnapshot } from "@/libs/posDailyStats";
import {
  isAppointmentPaid,
  normalizeAppointmentStatus,
} from "@/components/pos/appointmentStatus";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";
import { compareSpanishShortDates } from "@/libs/posClientCrmFields";
import { syncClientCrmSegments } from "@/libs/posClientCrmSegments";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();

    const date = (req.nextUrl.searchParams.get("date") || getTodaySpanishShortDate()).trim();
    const sessionCode = (req.nextUrl.searchParams.get("sessionCode") || "").trim();

    const payments = sessionCode
      ? await getPaymentsForSession(sessionCode)
      : await getPaymentsForDate(date);

    return NextResponse.json({
      date,
      sessionCode,
      summary: summarizePayments(payments),
      payments: payments.map(mapPaymentDoc),
    });
  } catch (error) {
    console.error("GET /api/pos/payments", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar los pagos" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const body = await req.json();
    const appointmentCode = String(body?.appointmentId || body?.appointmentCode || "").trim();
    const ticketCode = String(body?.ticketId || body?.ticketCode || "").trim();
    const method = String(body?.method || "").trim().toLowerCase();

    if (!appointmentCode) {
      return NextResponse.json(
        { error: "Se requiere la cita a cobrar" },
        { status: 400 }
      );
    }

    if (!PAYMENT_METHODS.includes(method)) {
      return NextResponse.json(
        { error: "Método de pago no válido" },
        { status: 400 }
      );
    }

    await connectMongo();

    const openSession = await getOpenCashSession();
    if (!openSession) {
      return NextResponse.json(
        { error: "No hay turno de caja abierto. Abre caja antes de cobrar." },
        { status: 409 }
      );
    }

    const appointment = await PosAppointment.findOne({ appointmentCode });
    if (!appointment) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    let ticket = null;
    if (ticketCode) {
      ticket = await PosCashTicket.findOne({ ticketCode });
      if (!ticket) {
        return NextResponse.json({ error: "Ficha de caja no encontrada" }, { status: 404 });
      }
      if (ticket.appointmentCode !== appointmentCode) {
        return NextResponse.json(
          { error: "La ficha no corresponde a esta cita" },
          { status: 409 }
        );
      }
      if (ticket.status !== "submitted") {
        return NextResponse.json(
          { error: "Esta ficha ya fue cobrada o cancelada" },
          { status: 409 }
        );
      }
    } else {
      const submittedTicket = await PosCashTicket.findOne({
        appointmentCode,
        status: "submitted",
      });
      if (submittedTicket) {
        return NextResponse.json(
          {
            error:
              "Esta cita tiene una ficha pendiente. Cobra desde la ficha enviada por la manicurista.",
          },
          { status: 409 }
        );
      }
    }

    const existingPayment = await PosPayment.findOne({ appointmentCode });
    if (existingPayment) {
      return NextResponse.json({ error: "Esta cita ya tiene un pago registrado" }, { status: 409 });
    }

    const currentStatus = normalizeAppointmentStatus(appointment.status);

    if (currentStatus === "cancelled") {
      return NextResponse.json({ error: "No se puede cobrar una cita cancelada" }, { status: 409 });
    }

    const canCollectInRegister =
      isAppointmentPaid(currentStatus) ||
      currentStatus === "confirmado" ||
      currentStatus === "agendado";

    if (!canCollectInRegister) {
      return NextResponse.json(
        { error: "Solo se pueden cobrar citas agendadas, confirmadas o pendientes de registro en caja" },
        { status: 409 }
      );
    }

    const amount =
      body.amount !== undefined
        ? Number(body.amount)
        : ticket
        ? Number(ticket.subtotal ?? 0)
        : Number(appointment.cost ?? 0);
    const tip = Number(body.tip ?? 0);

    const serviceLines = ticket?.lines?.length
      ? ticket.lines.map((line) => ({
          serviceId: line.serviceId || "",
          name: line.name,
          price: line.price,
        }))
      : [];

    const serviceName = ticket
      ? serviceLines.map((line) => line.name).join(" + ")
      : appointment.serviceName;

    let breakdown;
    try {
      breakdown = resolvePaymentBreakdown({
        method,
        amount,
        tip,
        cashAmount: body.cashAmount,
        cardAmount: body.cardAmount,
        transferAmount: body.transferAmount,
      });
    } catch (validationError) {
      return NextResponse.json({ error: validationError.message }, { status: 400 });
    }

    const headerReceptionistId = (req.headers.get("x-pos-receptionist-id") || "").trim().toUpperCase();
    let processedByReceptionistId = (
      body.processedByReceptionistId ||
      headerReceptionistId ||
      ""
    )
      .trim()
      .toUpperCase();

    let processedByReceptionistName = (body.processedByReceptionistName || "").trim();
    if (processedByReceptionistId && !processedByReceptionistName) {
      const receptionist = await PosReceptionist.findOne({
        receptionistCode: processedByReceptionistId,
      });
      processedByReceptionistName = receptionist?.name || "";
    }

    const paymentCode = `PAY-${Date.now()}`;

    const payment = await PosPayment.create({
      paymentCode,
      appointmentCode: appointment.appointmentCode,
      appointmentDate: appointment.date,
      clientId: appointment.clientId,
      clientName: appointment.clientName,
      staffId: appointment.staffId,
      staffName: appointment.staffName,
      ticketCode: ticket?.ticketCode || "",
      serviceName,
      serviceLines,
      amount: breakdown.amount,
      tip: breakdown.tip,
      total: breakdown.total,
      method,
      cashAmount: breakdown.cashAmount,
      cardAmount: breakdown.cardAmount,
      transferAmount: breakdown.transferAmount,
      giftCardAmount: breakdown.giftCardAmount,
      cashSessionCode: openSession.sessionCode,
      processedByReceptionistId,
      processedByReceptionistName,
      notes: (body.notes || "").trim(),
    });

    // El cobro ocurre en caja; el estatus de agenda queda como terminado.
    const targetStatus = "terminado";
    const wasAlreadyPaid = isAppointmentPaid(currentStatus);

    const updatedAppointment = await PosAppointment.findOneAndUpdate(
      { appointmentCode },
      { $set: { status: targetStatus, cost: breakdown.amount, serviceName } },
      { new: true }
    );

    if (ticket) {
      await PosCashTicket.updateOne(
        { ticketCode: ticket.ticketCode },
        {
          $set: {
            status: "charged",
            chargedAt: new Date(),
            paymentCode,
          },
        }
      );
    }

    const staff = await PosStaff.findOne({ staffCode: appointment.staffId });
    if (staff) {
      await PosStaff.updateOne(
        { staffCode: staff.staffCode },
        {
          $inc: {
            ...(wasAlreadyPaid ? {} : { completedToday: 1 }),
            weeklyRevenue: breakdown.amount,
          },
        }
      );
    }

    const client = await PosClient.findOne({ clientCode: appointment.clientId });
    if (client) {
      const nextVisits = (client.visitsCount ?? 0) + 1;
      const nextTotalSpent = (client.totalSpent ?? 0) + breakdown.amount;
      const nextLastPaid =
        !client.lastPaidVisitDate ||
        compareSpanishShortDates(appointment.date, client.lastPaidVisitDate) >= 0
          ? appointment.date
          : client.lastPaidVisitDate;

      await PosClient.updateOne(
        { clientCode: client.clientCode },
        {
          $set: {
            visitsCount: nextVisits,
            totalSpent: nextTotalSpent,
            averageTicket: nextTotalSpent / nextVisits,
            lastPaidVisitDate: nextLastPaid,
          },
        }
      );

      await syncClientCrmSegments(client.clientCode);
    }

    await refreshCashSessionTotals(openSession.sessionCode);
    await upsertDailySnapshot(appointment.date);

    return NextResponse.json(
      {
        payment: mapPaymentDoc(payment),
        appointment: mapAppointmentDoc(updatedAppointment),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/pos/payments", error);
    return NextResponse.json(
      { error: error.message || "No se pudo registrar el pago" },
      { status: 500 }
    );
  }
}
