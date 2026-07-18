import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { isMasterSessionRequest, requirePosSession } from "@/libs/posAuth";
import { mapCashSessionDoc, mapPaymentDoc } from "@/libs/posMappers";
import {
  getOpenCashSession,
  getPaymentsForDate,
  getPaymentsForSessionDay,
  summarizePayments,
} from "@/libs/posCashRegister";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();

    const today = getTodaySpanishShortDate();
    const openSession = await getOpenCashSession();
    const cashDay = isMasterSessionRequest(req)
      ? openSession?.shiftDate || today
      : today;

    // El turno se acota al día operativo: solo cuentan los cobros cuya fecha de
    // cita/venta coincide con el día de caja. Evita mezclar cobros de otros días
    // cuando el turno permanece abierto varias jornadas.
    const [shiftPayments, dayPayments] = await Promise.all([
      openSession
        ? getPaymentsForSessionDay(openSession.sessionCode, cashDay)
        : Promise.resolve([]),
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
