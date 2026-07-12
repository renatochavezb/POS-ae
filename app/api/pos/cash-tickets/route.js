import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import PosCashTicket from "@/models/PosCashTicket";
import PosAppointment from "@/models/PosAppointment";
import PosPayment from "@/models/PosPayment";
import { mapCashTicketDoc } from "@/libs/posMappers";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";
import { normalizeAppointmentStatus } from "@/components/pos/appointmentStatus";
import { normalizeWorkPhotos } from "@/libs/posWorkPhotos";

export const dynamic = "force-dynamic";

function normalizeLines(rawLines) {
  if (!Array.isArray(rawLines)) return [];

  return rawLines
    .map((line) => ({
      serviceId: String(line?.serviceId || "").trim(),
      name: String(line?.name || "").trim(),
      price: Number(line?.price ?? 0),
    }))
    .filter((line) => line.name.length > 0 && line.price >= 0);
}

function sumLines(lines) {
  return lines.reduce((sum, line) => sum + line.price, 0);
}

export async function GET(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();

    const date = (req.nextUrl.searchParams.get("date") || getTodaySpanishShortDate()).trim();
    const status = (req.nextUrl.searchParams.get("status") || "submitted").trim();
    const staffId = (req.nextUrl.searchParams.get("staffId") || "").trim().toUpperCase();
    const appointmentId = (req.nextUrl.searchParams.get("appointmentId") || "").trim();

    const query = { appointmentDate: date };

    if (status !== "all") {
      query.status = status;
    }

    if (staffId) {
      query.staffId = staffId;
    }

    if (appointmentId) {
      query.appointmentCode = appointmentId;
    }

    const tickets = await PosCashTicket.find(query).sort({ submittedAt: -1 });

    return NextResponse.json({
      date,
      tickets: tickets.map(mapCashTicketDoc),
    });
  } catch (error) {
    console.error("GET /api/pos/cash-tickets", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar las fichas de caja" },
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
    const lines = normalizeLines(body?.lines);
    const workPhotos = normalizeWorkPhotos(body?.workPhotos);

    if (!appointmentCode) {
      return NextResponse.json({ error: "Se requiere la cita" }, { status: 400 });
    }

    if (lines.length === 0) {
      return NextResponse.json(
        { error: "Agrega al menos un servicio con precio" },
        { status: 400 }
      );
    }

    if (lines.some((line) => line.price <= 0)) {
      return NextResponse.json(
        { error: "Cada servicio debe tener un precio mayor a cero" },
        { status: 400 }
      );
    }

    if (workPhotos.length === 0) {
      return NextResponse.json(
        { error: "Agrega al menos una foto del trabajo" },
        { status: 400 }
      );
    }

    if (workPhotos.length > 3) {
      return NextResponse.json(
        { error: "Máximo 3 fotos del trabajo por ficha" },
        { status: 400 }
      );
    }

    await connectMongo();

    const appointment = await PosAppointment.findOne({ appointmentCode });
    if (!appointment) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    const status = normalizeAppointmentStatus(appointment.status);
    if (status === "cancelled") {
      return NextResponse.json({ error: "No se puede enviar una cita cancelada" }, { status: 409 });
    }

    const headerStaffId = (req.headers.get("x-pos-staff-id") || "").trim().toUpperCase();
    const submittedByStaffId = (
      body.submittedByStaffId ||
      headerStaffId ||
      appointment.staffId ||
      ""
    )
      .trim()
      .toUpperCase();

    if (
      headerStaffId &&
      appointment.staffId &&
      headerStaffId !== appointment.staffId.toUpperCase()
    ) {
      return NextResponse.json(
        { error: "Solo la manicurista asignada puede enviar esta ficha" },
        { status: 403 }
      );
    }

    const existingPayment = await PosPayment.findOne({ appointmentCode });
    if (existingPayment) {
      return NextResponse.json(
        { error: "Esta cita ya fue cobrada en caja" },
        { status: 409 }
      );
    }

    const existingTicket = await PosCashTicket.findOne({
      appointmentCode,
      status: "submitted",
    });

    if (existingTicket) {
      return NextResponse.json(
        { error: "Ya hay una ficha pendiente para esta cita" },
        { status: 409 }
      );
    }

    const subtotal = sumLines(lines);
    const ticketCode = `TKT-${Date.now()}`;

    const ticket = await PosCashTicket.create({
      ticketCode,
      appointmentCode: appointment.appointmentCode,
      appointmentDate: appointment.date,
      clientId: appointment.clientId,
      clientName: appointment.clientName,
      staffId: appointment.staffId,
      staffName: appointment.staffName,
      lines,
      subtotal,
      workPhotos,
      status: "submitted",
      submittedByStaffId,
      submittedByStaffName: String(body.submittedByStaffName || appointment.staffName || "").trim(),
      submittedAt: new Date(),
    });

    const serviceName = lines.map((line) => line.name).join(" + ");

    await PosAppointment.updateOne(
      { appointmentCode },
      {
        $set: {
          serviceName,
          cost: subtotal,
          status: status === "agendado" ? "confirmado" : appointment.status,
        },
      }
    );

    return NextResponse.json({ ticket: mapCashTicketDoc(ticket) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/pos/cash-tickets", error);
    return NextResponse.json(
      { error: error.message || "No se pudo enviar la ficha a caja" },
      { status: 500 }
    );
  }
}
