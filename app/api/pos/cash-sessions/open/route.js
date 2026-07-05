import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import PosCashSession from "@/models/PosCashSession";
import { mapCashSessionDoc } from "@/libs/posMappers";
import { getOpenCashSession } from "@/libs/posCashRegister";
import {
  logCashRegisterAudit,
  verifyReceptionistPin,
} from "@/libs/posReceptionistAuth";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const body = await req.json();
    const openingFloat = Number(body?.openingFloat ?? 0);
    const receptionistId = String(
      body?.receptionistId || body?.openedByReceptionistId || ""
    ).trim();
    const pin = String(body?.pin || "").trim();

    if (openingFloat < 0) {
      return NextResponse.json(
        { error: "El fondo de caja no puede ser negativo" },
        { status: 400 }
      );
    }

    await connectMongo();

    let verified;
    try {
      verified = await verifyReceptionistPin(receptionistId, pin);
    } catch (authError) {
      await logCashRegisterAudit({
        action: "caja_open",
        receptionistId,
        success: false,
        errorMessage: authError.message,
      });
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    const existing = await getOpenCashSession();
    if (existing) {
      return NextResponse.json(
        { error: "Ya hay un turno de caja abierto. Ciérralo antes de abrir otro." },
        { status: 409 }
      );
    }

    const sessionCode = `CS-${Date.now()}`;
    const created = await PosCashSession.create({
      sessionCode,
      status: "open",
      shiftDate: getTodaySpanishShortDate(),
      openedByReceptionistId: verified.receptionistId,
      openedByReceptionistName: verified.receptionistName,
      openingFloat,
      openedWithMasterPin: verified.isMaster,
    });

    await logCashRegisterAudit({
      action: "caja_open",
      receptionistId: verified.receptionistId,
      receptionistName: verified.receptionistName,
      success: true,
      isMaster: verified.isMaster,
      cashSessionCode: sessionCode,
    });

    return NextResponse.json(mapCashSessionDoc(created), { status: 201 });
  } catch (error) {
    console.error("POST /api/pos/cash-sessions/open", error);
    return NextResponse.json(
      { error: error.message || "No se pudo abrir el turno de caja" },
      { status: 500 }
    );
  }
}
