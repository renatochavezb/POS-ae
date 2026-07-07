import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapCashSessionDoc, mapPaymentDoc } from "@/libs/posMappers";
import {
  getOpenCashSession,
  getPaymentsForDate,
  getPaymentsForSession,
  summarizePayments,
} from "@/libs/posCashRegister";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();

    const today = getTodaySpanishShortDate();
    const openSession = await getOpenCashSession();
    const cashDay = openSession?.shiftDate || today;

    const [shiftPayments, dayPayments] = await Promise.all([
      openSession ? getPaymentsForSession(openSession.sessionCode) : Promise.resolve([]),
      getPaymentsForDate(cashDay),
    ]);

    return NextResponse.json({
      session: openSession ? mapCashSessionDoc(openSession) : null,
      shiftSummary: summarizePayments(shiftPayments),
      daySummary: summarizePayments(dayPayments),
      shiftPayments: shiftPayments.map(mapPaymentDoc),
      dayPayments: dayPayments.map(mapPaymentDoc),
      today,
      cashDay,
    });
  } catch (error) {
    console.error("GET /api/pos/cash-sessions/current", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar el turno de caja" },
      { status: 500 }
    );
  }
}
