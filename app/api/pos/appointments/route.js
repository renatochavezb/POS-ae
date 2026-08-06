import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession, rejectManicuristaAgendaMutation } from "@/libs/posAuth";
import { mapAppointmentDoc } from "@/libs/posMappers";
import PosAppointment from "@/models/PosAppointment";
import PosStaff from "@/models/PosStaff";
import PosClient from "@/models/PosClient";
import PosReceptionist from "@/models/PosReceptionist";
import { getTodaySpanishShortDate, buildSpanishDateLabelsAroundToday, buildWeekDayEntries, getStudioWeekStart, addDays } from "@/components/pos/scheduleUtils";
import { parseSpanishShortDateLabel } from "@/libs/spanishDateUtils";
import { mapReceptionistDoc } from "@/libs/posMappers";
import { seedPosReceptionistsIfEmpty, refreshReceptionistDailyCounts } from "@/libs/posSeed";
import { findConflictingAppointment } from "@/libs/posAppointmentConflicts";
import { upsertDailySnapshot } from "@/libs/posDailyStats";
import { refreshWeeklySnapshotsForDates } from "@/libs/posWeeklyStats";
import { syncClientCrmSegmentsForClients } from "@/libs/posClientCrmSegments";

export const dynamic = "force-dynamic";

function parseWindowParam(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(120, Math.floor(n)));
}

function resolveDateLabelsFromRequest(req) {
  const weekStartParam = (req.nextUrl.searchParams.get("weekStart") || "").trim();
  if (weekStartParam) {
    const parsed = parseSpanishShortDateLabel(weekStartParam);
    if (!parsed) return null;
    const weekCount = Math.max(
      1,
      Math.min(8, parseWindowParam(req.nextUrl.searchParams.get("weekCount"), 1))
    );
    const start = getStudioWeekStart(parsed);
    const labels = [];
    for (let index = 0; index < weekCount; index += 1) {
      buildWeekDayEntries(addDays(start, index * 7)).forEach((day) => {
        labels.push(day.dateLabel);
      });
    }
    return labels;
  }

  const daysBeforeParam = req.nextUrl.searchParams.get("daysBefore");
  const daysAfterParam = req.nextUrl.searchParams.get("daysAfter");
  if (daysBeforeParam != null || daysAfterParam != null) {
    const daysBefore = parseWindowParam(daysBeforeParam, 7);
    const daysAfter = parseWindowParam(daysAfterParam, 14);
    return buildSpanishDateLabelsAroundToday(daysBefore, daysAfter);
  }

  return null;
}

export async function GET(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();

    const dateLabels = resolveDateLabelsFromRequest(req);
    // Sin params: no devolver todo el histórico (egress). Requiere weekStart o ventana.
    const query =
      dateLabels && dateLabels.length > 0 ? { date: { $in: dateLabels } } : { date: { $in: [] } };

    const appointments = await PosAppointment.find(query).sort({ date: 1, time: 1 });
    return NextResponse.json(appointments.map(mapAppointmentDoc));
  } catch (error) {
    console.error("GET /api/pos/appointments", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar la agenda" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const manicuristaBlock = rejectManicuristaAgendaMutation(req, "agendar citas");
    if (manicuristaBlock) return manicuristaBlock;

    const body = await req.json();

    if (
      !body?.date ||
      !body?.time ||
      !body?.clientName ||
      !body?.clientId ||
      !body?.staffId ||
      !body?.serviceName
    ) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios para crear la cita" },
        { status: 400 }
      );
    }

    await connectMongo();
    await seedPosReceptionistsIfEmpty();

    const client = await PosClient.findOne({ clientCode: body.clientId });
    if (!client) {
      return NextResponse.json(
        { error: "La clienta seleccionada no existe. Regístrala antes de agendar." },
        { status: 400 }
      );
    }

    const duration = body.duration ?? 60;
    const conflict = await findConflictingAppointment({
      date: body.date,
      staffId: body.staffId,
      time: body.time,
      duration,
    });

    if (conflict) {
      return NextResponse.json(
        {
          error: `Horario ocupado: ${conflict.clientName} ya tiene cita con ${conflict.staffName} a las ${conflict.time}.`,
        },
        { status: 409 }
      );
    }

    const appointmentCode =
      body.appointmentCode || `APP-${Date.now().toString()}`;

    const headerReceptionistId = (req.headers.get("x-pos-receptionist-id") || "").trim();
    let bookedByReceptionistId = (
      body.bookedByReceptionistId ||
      headerReceptionistId ||
      ""
    )
      .trim()
      .toUpperCase();

    const todayLabel = getTodaySpanishShortDate();
    let bookedByReceptionistName = (body.bookedByReceptionistName || "").trim();

    if (bookedByReceptionistId && !bookedByReceptionistName) {
      const receptionist = await PosReceptionist.findOne({
        receptionistCode: bookedByReceptionistId,
      });
      bookedByReceptionistName = receptionist?.name || "";
    }

    const created = await PosAppointment.create({
      appointmentCode,
      date: body.date,
      time: body.time,
      serviceName: body.serviceName,
      serviceSubtitle: body.serviceSubtitle || "",
      serviceImage: body.serviceImage || "",
      clientName: body.clientName,
      clientId: body.clientId,
      staffId: body.staffId,
      staffName: body.staffName,
      staffInitials: body.staffInitials,
      cost: body.cost ?? 0,
      duration: body.duration ?? 60,
      status: body.status || "agendado",
      bookedByReceptionistId,
      bookedByReceptionistName,
      bookedOnDate: bookedByReceptionistId ? todayLabel : "",
    });

    if (body.staffStats) {
      await PosStaff.findOneAndUpdate(
        { staffCode: body.staffStats.staffId || body.staffId },
        {
          totalToday: body.staffStats.totalToday,
          weeklyRevenue: body.staffStats.weeklyRevenue,
        }
      );
    }

    if (body.clientStats?.clientId) {
      await PosClient.findOneAndUpdate(
        { clientCode: body.clientStats.clientId },
        {
          visitsCount: body.clientStats.visitsCount,
          totalSpent: body.clientStats.totalSpent,
          averageTicket: body.clientStats.averageTicket,
        }
      );
    }

    if (bookedByReceptionistId) {
      await refreshReceptionistDailyCounts(todayLabel);
    }

    await upsertDailySnapshot(body.date);
    await refreshWeeklySnapshotsForDates([body.date]);

    await syncClientCrmSegmentsForClients([body.clientId]);

    let receptionistsSnapshot = null;
    if (bookedByReceptionistId) {
      const receptionists = await PosReceptionist.find().sort({ name: 1 });
      receptionistsSnapshot = receptionists.map(mapReceptionistDoc);
    }

    return NextResponse.json(
      {
        ...mapAppointmentDoc(created),
        ...(receptionistsSnapshot ? { receptionists: receptionistsSnapshot } : {}),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/pos/appointments", error);
    return NextResponse.json(
      { error: error.message || "No se pudo crear la cita" },
      { status: 500 }
    );
  }
}
