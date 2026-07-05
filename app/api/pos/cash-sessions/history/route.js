import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapCashSessionDoc } from "@/libs/posMappers";
import { getClosedCashSessions } from "@/libs/posCashRegister";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();

    const dateParam = (req.nextUrl.searchParams.get("date") || "").trim();
    const scope = (req.nextUrl.searchParams.get("scope") || "today").trim();
    const limit = Math.min(
      Math.max(Number(req.nextUrl.searchParams.get("limit") || 30), 1),
      100
    );

    const date = scope === "today" ? dateParam || getTodaySpanishShortDate() : "";
    const sessions = await getClosedCashSessions({
      date: scope === "today" ? date : undefined,
      limit,
    });

    return NextResponse.json({
      scope,
      date: date || null,
      sessions: sessions.map(mapCashSessionDoc),
    });
  } catch (error) {
    console.error("GET /api/pos/cash-sessions/history", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar el historial de cortes" },
      { status: 500 }
    );
  }
}
