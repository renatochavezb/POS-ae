import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import {
  requirePosSession,
  rejectManicuristaAgendaMutation,
  isMasterSessionRequest,
} from "@/libs/posAuth";
import { mapAppointmentDoc } from "@/libs/posMappers";
import PosAppointment from "@/models/PosAppointment";
import PosStaff from "@/models/PosStaff";
import PosClient from "@/models/PosClient";
import PosPayment from "@/models/PosPayment";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";
import { findConflictingAppointment } from "@/libs/posAppointmentConflicts";
import { refreshReceptionistDailyCounts } from "@/libs/posSeed";
import { refreshDailySnapshotsForDates } from "@/libs/posDailyStats";
import { refreshWeeklySnapshotsForDates } from "@/libs/posWeeklyStats";
import { syncClientCrmSegmentsForClients } from "@/libs/posClientCrmSegments";
import {
  canDeleteAppointment,
  getNextAppointmentStatus,
  getPreviousAppointmentStatus,
  isAppointmentLockedOnBoard,
  normalizeAppointmentStatus,
} from "@/components/pos/appointmentStatus";
import { authorizeReceptionistAction } from "@/libs/posReceptionistAuth";

export const dynamic = "force-dynamic";

function isAdminOverride(req, body) {
  return Boolean(body?.adminOverride) && isMasterSessionRequest(req);
}

async function appointmentHasPayment(appointmentCode) {
  const payment = await PosPayment.findOne({
    appointmentCode,
    transactionType: { $ne: "gift_card_sale" },
  }).select("paymentCode total amount");
  return payment;
}

export async function PATCH(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const manicuristaBlock = rejectManicuristaAgendaMutation(req, "modificar citas");
    if (manicuristaBlock) return manicuristaBlock;

    const { appointmentId } = await params;
    const body = await req.json();
    const adminOverride = isAdminOverride(req, body);

    await connectMongo();

    const existing = await PosAppointment.findOne({
      appointmentCode: appointmentId,
    });

    if (!existing) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    const currentStatus = normalizeAppointmentStatus(existing.status);

    const isFieldUpdate =
      body.date ||
      body.time ||
      body.duration !== undefined ||
      body.serviceName ||
      body.serviceSubtitle !== undefined ||
      body.cost !== undefined ||
      body.staffId;

    if (body.staffId && body.staffId !== existing.staffId) {
      return NextResponse.json(
        {
          error:
            "No se puede cambiar la manicurista. Cancela la cita y crea una nueva con la especialista deseada.",
        },
        { status: 403 }
      );
    }

    if (isFieldUpdate && isAppointmentLockedOnBoard(currentStatus) && !adminOverride) {
      return NextResponse.json(
        { error: "No se puede modificar una cita confirmada o terminada." },
        { status: 403 }
      );
    }

    if (body.status) {
      const nextStatus = normalizeAppointmentStatus(body.status);

      if (adminOverride) {
        const allowed =
          nextStatus === currentStatus ||
          nextStatus === "cancelled" ||
          nextStatus === getNextAppointmentStatus(currentStatus) ||
          nextStatus === getPreviousAppointmentStatus(currentStatus);

        if (!allowed) {
          return NextResponse.json(
            { error: "Transición de estatus no permitida." },
            { status: 403 }
          );
        }
      } else if (nextStatus === "cancelled") {
        if (currentStatus !== "agendado") {
          return NextResponse.json(
            { error: "Solo se pueden cancelar citas agendadas." },
            { status: 403 }
          );
        }

        try {
          await authorizeReceptionistAction(body, "appointment_cancel");
        } catch (authError) {
          return NextResponse.json({ error: authError.message }, { status: 401 });
        }
      } else {
        const expectedNext = getNextAppointmentStatus(currentStatus);

        if (expectedNext !== nextStatus) {
          return NextResponse.json(
            { error: "Solo se permite avanzar al siguiente estatus." },
            { status: 403 }
          );
        }
      }
    }

    if (isAppointmentLockedOnBoard(currentStatus) && !body.status && !adminOverride) {
      return NextResponse.json(
        { error: "No se puede modificar una cita confirmada o terminada." },
        { status: 403 }
      );
    }

    const nextDate = body.date ?? existing.date;
    const nextTime = body.time ?? existing.time;
    const nextDuration =
      body.duration !== undefined ? body.duration : (existing.duration ?? 60);
    const nextStaffId = existing.staffId;

    if (body.date || body.time || body.duration !== undefined) {
      const conflict = await findConflictingAppointment({
        date: nextDate,
        staffId: nextStaffId,
        time: nextTime,
        duration: nextDuration,
        excludeAppointmentId: appointmentId,
      });

      if (conflict) {
        return NextResponse.json(
          {
            error: `Horario ocupado: ${conflict.clientName} ya tiene cita a las ${conflict.time}.`,
          },
          { status: 409 }
        );
      }
    }

    const payment = body.status ? await appointmentHasPayment(appointmentId) : null;

    const updated = await PosAppointment.findOneAndUpdate(
      { appointmentCode: appointmentId },
      {
        ...(body.status ? { status: body.status } : {}),
        ...(body.date ? { date: body.date } : {}),
        ...(body.time ? { time: body.time } : {}),
        ...(body.duration !== undefined ? { duration: body.duration } : {}),
        ...(body.serviceName ? { serviceName: body.serviceName } : {}),
        ...(body.serviceSubtitle !== undefined
          ? { serviceSubtitle: body.serviceSubtitle }
          : {}),
        ...(body.cost !== undefined ? { cost: body.cost } : {}),
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    if (body.staffStats?.staffId) {
      await PosStaff.findOneAndUpdate(
        { staffCode: body.staffStats.staffId },
        {
          ...(body.staffStats.completedToday !== undefined
            ? { completedToday: body.staffStats.completedToday }
            : {}),
          ...(body.staffStats.totalToday !== undefined
            ? { totalToday: body.staffStats.totalToday }
            : {}),
          ...(body.staffStats.weeklyRevenue !== undefined
            ? { weeklyRevenue: body.staffStats.weeklyRevenue }
            : {}),
        }
      );
    }

    await refreshDailySnapshotsForDates([
      existing.date,
      updated.date !== existing.date ? updated.date : null,
    ]);
    await refreshWeeklySnapshotsForDates([existing.date, updated.date]);

    await syncClientCrmSegmentsForClients([
      existing.clientId,
      updated.clientId !== existing.clientId ? updated.clientId : null,
    ]);

    return NextResponse.json({
      ...mapAppointmentDoc(updated),
      isPaid: Boolean(payment),
      paymentId: payment?.paymentCode || "",
    });
  } catch (error) {
    console.error("PATCH /api/pos/appointments/[appointmentId]", error);
    return NextResponse.json(
      { error: error.message || "No se pudo actualizar la cita" },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const manicuristaBlock = rejectManicuristaAgendaMutation(req, "eliminar citas");
    if (manicuristaBlock) return manicuristaBlock;

    const { appointmentId } = await params;
    const body = await req.json().catch(() => ({}));
    const adminOverride = isAdminOverride(req, body);

    await connectMongo();

    const existing = await PosAppointment.findOne({
      appointmentCode: appointmentId,
    });

    if (!existing) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    if (!adminOverride && !canDeleteAppointment(existing.status)) {
      return NextResponse.json(
        { error: "No se puede eliminar una cita confirmada o terminada." },
        { status: 403 }
      );
    }

    if (!adminOverride) {
      try {
        await authorizeReceptionistAction(body, "appointment_delete");
      } catch (authError) {
        return NextResponse.json({ error: authError.message }, { status: 401 });
      }
    }

    const payment = await appointmentHasPayment(appointmentId);

    const deleted = await PosAppointment.findOneAndDelete({
      appointmentCode: appointmentId,
    });

    if (body.staffStats?.staffId) {
      await PosStaff.findOneAndUpdate(
        { staffCode: body.staffStats.staffId },
        {
          ...(body.staffStats.completedToday !== undefined
            ? { completedToday: body.staffStats.completedToday }
            : {}),
          ...(body.staffStats.totalToday !== undefined
            ? { totalToday: body.staffStats.totalToday }
            : {}),
          ...(body.staffStats.weeklyRevenue !== undefined
            ? { weeklyRevenue: body.staffStats.weeklyRevenue }
            : {}),
        }
      );
    }

    if (body.clientStats?.clientId) {
      await PosClient.findOneAndUpdate(
        { clientCode: body.clientStats.clientId },
        {
          ...(body.clientStats.visitsCount !== undefined
            ? { visitsCount: body.clientStats.visitsCount }
            : {}),
          ...(body.clientStats.totalSpent !== undefined
            ? { totalSpent: body.clientStats.totalSpent }
            : {}),
          ...(body.clientStats.averageTicket !== undefined
            ? { averageTicket: body.clientStats.averageTicket }
            : {}),
        }
      );
    }

    if (
      deleted.bookedByReceptionistId &&
      deleted.bookedOnDate === getTodaySpanishShortDate()
    ) {
      await refreshReceptionistDailyCounts();
    } else if (body.receptionistStats?.receptionistId) {
      await refreshReceptionistDailyCounts();
    }

    await refreshDailySnapshotsForDates([deleted.date]);
    await refreshWeeklySnapshotsForDates([deleted.date]);

    await syncClientCrmSegmentsForClients([deleted.clientId]);

    return NextResponse.json({
      success: true,
      deletedId: deleted.appointmentCode,
      hardDelete: true,
      isPaid: Boolean(payment),
      paymentId: payment?.paymentCode || "",
    });
  } catch (error) {
    console.error("DELETE /api/pos/appointments/[appointmentId]", error);
    return NextResponse.json(
      { error: error.message || "No se pudo eliminar la cita" },
      { status: 500 }
    );
  }
}
