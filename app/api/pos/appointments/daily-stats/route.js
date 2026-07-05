import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import {
  getDailySnapshotForDate,
  upsertDailySnapshot,
} from "@/libs/posDailyStats";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const date = (req.nextUrl.searchParams.get("date") || "").trim();
    if (!date) {
      return NextResponse.json(
        { error: "Se requiere el parámetro date" },
        { status: 400 }
      );
    }

    await connectMongo();

    const refresh = req.nextUrl.searchParams.get("refresh") === "1";
    const stats = refresh
      ? await upsertDailySnapshot(date)
      : await getDailySnapshotForDate(date);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("GET /api/pos/appointments/daily-stats", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar las estadísticas del día" },
      { status: 500 }
    );
  }
}
