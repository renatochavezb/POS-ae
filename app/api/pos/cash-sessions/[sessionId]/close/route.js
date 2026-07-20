import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { isMasterSessionRequest, requirePosSession } from "@/libs/posAuth";
import PosCashSession from "@/models/PosCashSession";
import PosPayment from "@/models/PosPayment";
import { mapCashSessionDoc } from "@/libs/posMappers";
import {
  computeExpectedCashForSessionDay,
  getPaymentsForSessionDay,
  refreshCashSessionTotals,
  summarizePayments,
} from "@/libs/posCashRegister";
import {
  logCashRegisterAudit,
  verifyReceptionistPin,
} from "@/libs/posReceptionistAuth";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";
import { refreshWeeklySnapshotsForDates } from "@/libs/posWeeklyStats";

export const dynamic = "force-dynamic";

const amountsMatch = (left, right) => Math.abs(left - right) < 0.01;

export async function POST(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const { sessionId } = await params;
    const body = await req.json();
    const closingCountedCash = Number(body?.closingCountedCash ?? 0);
    const closingCountedCard = Number(body?.closingCountedCard ?? 0);
    const closingCountedTransfer = Number(body?.closingCountedTransfer ?? 0);
    const receptionistId = String(
      body?.receptionistId || body?.closedByReceptionistId || ""
    ).trim();
    const pin = String(body?.pin || "").trim();

    if (
      closingCountedCash < 0 ||
      closingCountedCard < 0 ||
      closingCountedTransfer < 0
    ) {
      return NextResponse.json(
        { error: "Los montos contados no pueden ser negativos" },
        { status: 400 }
      );
    }

    await connectMongo();

    const session = await PosCashSession.findOne({ sessionCode: sessionId });

    if (!session) {
      return NextResponse.json({ error: "Turno de caja no encontrado" }, { status: 404 });
    }

    if (session.status === "closed") {
      return NextResponse.json({ error: "Este turno ya fue cerrado" }, { status: 409 });
    }

    let verified;
    try {
      verified = await verifyReceptionistPin(receptionistId, pin);
    } catch (authError) {
      await logCashRegisterAudit({
        action: "caja_close",
        receptionistId,
        success: false,
        cashSessionCode: sessionId,
        errorMessage: authError.message,
      });
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    // El corte se cierra solo sobre el día operativo del turno. Los cobros de
    // otros días (por turnos que quedaron abiertos) no entran a este corte.
    const cashDay = isMasterSessionRequest(req)
      ? session.shiftDate
      : getTodaySpanishShortDate();
    const dayPayments = await getPaymentsForSessionDay(session.sessionCode, cashDay);
    const daySummary = summarizePayments(dayPayments);

    const expectedCash = await computeExpectedCashForSessionDay(session, cashDay);
    const expectedCard = daySummary.tarjeta ?? 0;
    const expectedTransfer = daySummary.transferencia ?? 0;

    const variance = closingCountedCash - expectedCash;
    const cardVariance = closingCountedCard - expectedCard;
    const transferVariance = closingCountedTransfer - expectedTransfer;
    const isPerfectCut =
      amountsMatch(closingCountedCash, expectedCash) &&
      amountsMatch(closingCountedCard, expectedCard) &&
      amountsMatch(closingCountedTransfer, expectedTransfer);

    const updated = await PosCashSession.findOneAndUpdate(
      { sessionCode: sessionId },
      {
        $set: {
          status: "closed",
          shiftDate: cashDay,
          paymentsCount: daySummary.count,
          totalAmount: daySummary.total,
          totalEfectivo: daySummary.efectivo,
          totalTarjeta: daySummary.tarjeta,
          totalTransferencia: daySummary.transferencia,
          totalGiftCard: daySummary.gift_card,
          totalGiftCardSales: daySummary.giftCardSales,
          closingCountedCash,
          closingCountedCard,
          closingCountedTransfer,
          expectedCash,
          expectedCard,
          expectedTransfer,
          variance,
          cardVariance,
          transferVariance,
          isPerfectCut,
          closedAt: new Date(),
          closedByReceptionistId: verified.receptionistId,
          closedByReceptionistName: verified.receptionistName,
          closedWithMasterPin: verified.isMaster,
          closingNotes: (body.closingNotes || "").trim(),
        },
      },
      { new: true }
    );

    // Reajuste: los cobros de otros días que quedaron en este turno se pasan a un
    // turno nuevo abierto para que se corten en el día que les corresponde y no
    // se pierdan al cerrar este.
    const strayPayments = await PosPayment.find({
      cashSessionCode: session.sessionCode,
      appointmentDate: { $ne: cashDay },
    });

    if (strayPayments.length > 0) {
      const carrySessionCode = `CS-${Date.now()}`;
      const strayDays = [...new Set(strayPayments.map((p) => p.appointmentDate).filter(Boolean))];

      await PosCashSession.create({
        sessionCode: carrySessionCode,
        status: "open",
        shiftDate: strayDays[0] || cashDay,
        openedByReceptionistId: verified.receptionistId,
        openedByReceptionistName: verified.receptionistName,
        openingFloat: 0,
        openedWithMasterPin: verified.isMaster,
      });

      await PosPayment.updateMany(
        { cashSessionCode: session.sessionCode, appointmentDate: { $ne: cashDay } },
        { $set: { cashSessionCode: carrySessionCode } }
      );

      await refreshCashSessionTotals(carrySessionCode);

      await logCashRegisterAudit({
        action: "caja_open",
        receptionistId: verified.receptionistId,
        receptionistName: verified.receptionistName,
        success: true,
        isMaster: verified.isMaster,
        cashSessionCode: carrySessionCode,
        actionDetails: {
          reason: "reajuste_cobros_otro_dia",
          fromSession: session.sessionCode,
          movedPayments: strayPayments.length,
          days: strayDays,
        },
      });
    }

    await logCashRegisterAudit({
      action: "caja_close",
      receptionistId: verified.receptionistId,
      receptionistName: verified.receptionistName,
      success: true,
      isMaster: verified.isMaster,
      cashSessionCode: sessionId,
      actionDetails: {
        shiftDate: cashDay,
        openingFloat: session.openingFloat ?? 0,
        paymentsCount: daySummary.count,
        totalAmount: daySummary.total,
        expectedCash,
        expectedCard,
        expectedTransfer,
        closingCountedCash,
        closingCountedCard,
        closingCountedTransfer,
        variance,
        cardVariance,
        transferVariance,
        isPerfectCut,
        closingNotes: (body.closingNotes || "").trim(),
      },
    });

    const weeklyDatesToRefresh = [cashDay];
    if (strayPayments.length > 0) {
      weeklyDatesToRefresh.push(
        ...new Set(strayPayments.map((payment) => payment.appointmentDate).filter(Boolean))
      );
    }
    await refreshWeeklySnapshotsForDates(weeklyDatesToRefresh);

    return NextResponse.json(mapCashSessionDoc(updated));
  } catch (error) {
    console.error("POST /api/pos/cash-sessions/[sessionId]/close", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cerrar el turno de caja" },
      { status: 500 }
    );
  }
}
