import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession, rejectManicuristaAgendaMutation } from "@/libs/posAuth";
import { mapBlockedSlotDoc } from "@/libs/posMappers";
import PosBlockedSlot from "@/models/PosBlockedSlot";
import { buildSpanishDateLabelsAroundToday, buildWeekDayEntries, getStudioWeekStartYmd, spanishShortDateToYmd, dateFromMexicoYmd, ymdAddDays } from "@/components/pos/scheduleUtils";

export const dynamic = "force-dynamic";

function parseWindowParam(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(120, Math.floor(n)));
}

function resolveDateLabelsFromRequest(req) {
  const weekStartParam = (req.nextUrl.searchParams.get("weekStart") || "").trim();
  if (weekStartParam) {
    const weekStartYmd = spanishShortDateToYmd(weekStartParam);
    if (!weekStartYmd) return null;
    const weekCount = Math.max(
      1,
      Math.min(8, parseWindowParam(req.nextUrl.searchParams.get("weekCount"), 1))
    );
    const startYmd = getStudioWeekStartYmd(weekStartYmd);
    const labels = [];
    for (let index = 0; index < weekCount; index += 1) {
      buildWeekDayEntries(dateFromMexicoYmd(ymdAddDays(startYmd, index * 7))).forEach(
        (day) => {
          labels.push(day.dateLabel);
        }
      );
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
    const query =
      dateLabels && dateLabels.length > 0 ? { date: { $in: dateLabels } } : { date: { $in: [] } };

    const blockedSlots = await PosBlockedSlot.find(query).sort({ date: 1, time: 1 });
    return NextResponse.json(blockedSlots.map(mapBlockedSlotDoc));
  } catch (error) {
    console.error("GET /api/pos/blocked-slots", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar los cierres de horario" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const manicuristaBlock = rejectManicuristaAgendaMutation(req, "cerrar horarios");
    if (manicuristaBlock) return manicuristaBlock;

    const body = await req.json();

    if (!body?.date || !body?.staffId || !body?.time) {
      return NextResponse.json(
        { error: "Fecha, manicurista y hora son obligatorios" },
        { status: 400 }
      );
    }

    await connectMongo();

    const blockedSlotCode =
      body.blockedSlotCode || `BLK-${Date.now().toString().slice(-6)}`;

    const created = await PosBlockedSlot.create({
      blockedSlotCode,
      date: body.date,
      staffId: body.staffId,
      time: body.time,
      duration: body.duration ?? 30,
      reason: body.reason || "",
    });

    return NextResponse.json(mapBlockedSlotDoc(created), { status: 201 });
  } catch (error) {
    console.error("POST /api/pos/blocked-slots", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cerrar el horario" },
      { status: 500 }
    );
  }
}
