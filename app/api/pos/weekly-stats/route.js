import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapWeeklySnapshotDoc } from "@/libs/posMappers";
import {
  buildStaffPerformanceHistory,
  getAllWeeklySnapshots,
  getWeeklySnapshotForWeekStart,
  refreshAllWeeklySnapshots,
  resolveWeekStartDateLabel,
  upsertWeeklySnapshot,
} from "@/libs/posWeeklyStats";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();

    const refreshParam = (req.nextUrl.searchParams.get("refresh") || "").trim();
    const scopeParam = (req.nextUrl.searchParams.get("scope") || "").trim();
    const weekStartParam = (req.nextUrl.searchParams.get("weekStart") || "").trim();

    if (scopeParam === "history") {
      // Solo lectura de snapshots. Recomputar 6 semanas aquí inflaba Function Duration.
      const snapshots = await getAllWeeklySnapshots();
      return NextResponse.json({
        scope: "history",
        count: snapshots.length,
        snapshots: snapshots.map(mapWeeklySnapshotDoc),
      });
    }

    if (scopeParam === "staff-performance") {
      const result = await buildStaffPerformanceHistory({
        refreshCurrent: refreshParam === "1",
      });
      return NextResponse.json({
        scope: "staff-performance",
        weekCount: result.weeks.length,
        staffCount: result.staff.length,
        ...result,
      });
    }

    if (refreshParam === "all") {
      const result = await refreshAllWeeklySnapshots();
      const snapshots = result.snapshots || result;
      return NextResponse.json({
        scope: "all",
        count: snapshots.length,
        deleted: result.cleanup?.deleted || [],
        snapshots: snapshots.map(mapWeeklySnapshotDoc),
      });
    }

    const weekStartDate = resolveWeekStartDateLabel(weekStartParam);
    if (!weekStartDate) {
      return NextResponse.json(
        { error: "Semana inválida. Usa weekStart con formato «12 Jul, 2026»." },
        { status: 400 }
      );
    }

    const refresh = refreshParam === "1";
    const snapshot = refresh
      ? await upsertWeeklySnapshot(weekStartDate)
      : await getWeeklySnapshotForWeekStart(weekStartDate);

    return NextResponse.json({
      scope: "week",
      weekStartDate,
      snapshot: mapWeeklySnapshotDoc(snapshot),
    });
  } catch (error) {
    console.error("GET /api/pos/weekly-stats", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar los KPIs semanales" },
      { status: 500 }
    );
  }
}
