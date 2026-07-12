import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession, rejectManicuristaAgendaMutation } from "@/libs/posAuth";
import { mapAppointmentDoc } from "@/libs/posMappers";
import PosAppointment from "@/models/PosAppointment";
import PosStaff from "@/models/PosStaff";
import PosClient from "@/models/PosClient";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";
import { findConflictingAppointment } from "@/libs/posAppointmentConflicts";
import { refreshReceptionistDailyCounts } from "@/libs/posSeed";
import { refreshDailySnapshotsForDates } from "@/libs/posDailyStats";
import { syncClientCrmSegmentsForClients } from "@/libs/posClientCrmSegments";
import {
  canDeleteAppointment,
  getNextAppointmentStatus,
  isAppointmentLockedOnBoard,
  normalizeAppointmentStatus,
} from "@/components/pos/appointmentStatus";
import { authorizeReceptionistAction } from "@/libs/posReceptionistAuth";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const manicuristaBlock = rejectManicuristaAgendaMutation(req, "modificar citas");
    if (manicuristaBlock) return manicuristaBlock;

    const { appointmentId } = await params;
    const body = await req.json();

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

    if (isFieldUpdate && isAppointmentLockedOnBoard(currentStatus)) {
      return NextResponse.json(
        { error: "No se puede modificar una cita confirmada o pagada." },
        { status: 403 }
      );
    }

    if (body.status) {
      const nextStatus = normalizeAppointmentStatus(body.status);

      if (nextStatus === "cancelled") {
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

    if (isAppointmentLockedOnBoard(currentStatus) && !body.status) {
      return NextResponse.json(
        { error: "No se puede modificar una cita confirmada o pagada." },
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

    await syncClientCrmSegmentsForClients([
      existing.clientId,
      updated.clientId !== existing.clientId ? updated.clientId : null,
    ]);

    return NextResponse.json(mapAppointmentDoc(updated));
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

    await connectMongo();

    const existing = await PosAppointment.findOne({
      appointmentCode: appointmentId,
    });

    if (!existing) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    if (!canDeleteAppointment(existing.status)) {
      return NextResponse.json(
        { error: "No se puede eliminar una cita confirmada o pagada." },
        { status: 403 }
      );
    }

    try {
      await authorizeReceptionistAction(body, "appointment_delete");
    } catch (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

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

    await syncClientCrmSegmentsForClients([deleted.clientId]);

    return NextResponse.json({
      success: true,
      deletedId: deleted.appointmentCode,
      hardDelete: true,
    });
  } catch (error) {
    console.error("DELETE /api/pos/appointments/[appointmentId]", error);
    return NextResponse.json(
      { error: error.message || "No se pudo eliminar la cita" },
      { status: 500 }
    );
  }
}
