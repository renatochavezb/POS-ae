import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import PosCashSession from "@/models/PosCashSession";
import { mapCashSessionDoc } from "@/libs/posMappers";
import {
  computeExpectedCashForSession,
  refreshCashSessionTotals,
} from "@/libs/posCashRegister";
import {
  logCashRegisterAudit,
  verifyReceptionistPin,
} from "@/libs/posReceptionistAuth";

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

    await refreshCashSessionTotals(session.sessionCode);
    const refreshed = await PosCashSession.findOne({ sessionCode: sessionId });

    const expectedCash = await computeExpectedCashForSession(refreshed);
    const expectedCard = refreshed.totalTarjeta ?? 0;
    const expectedTransfer = refreshed.totalTransferencia ?? 0;

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

    await logCashRegisterAudit({
      action: "caja_close",
      receptionistId: verified.receptionistId,
      receptionistName: verified.receptionistName,
      success: true,
      isMaster: verified.isMaster,
      cashSessionCode: sessionId,
      actionDetails: {
        shiftDate: refreshed.shiftDate,
        openingFloat: refreshed.openingFloat ?? 0,
        paymentsCount: refreshed.paymentsCount ?? 0,
        totalAmount: refreshed.totalAmount ?? 0,
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

    return NextResponse.json(mapCashSessionDoc(updated));
  } catch (error) {
    console.error("POST /api/pos/cash-sessions/[sessionId]/close", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cerrar el turno de caja" },
      { status: 500 }
    );
  }
}
