import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requireMasterSession, requirePosSession } from "@/libs/posAuth";
import PosCashSession from "@/models/PosCashSession";
import { mapCashSessionDoc } from "@/libs/posMappers";
import { parseSpanishShortDateLabel } from "@/libs/spanishDateUtils";
import {
  logCashRegisterAudit,
  verifyReceptionistPin,
} from "@/libs/posReceptionistAuth";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const masterResult = requireMasterSession(req);
    if (masterResult.error) {
      return NextResponse.json(
        { error: "Solo el administrador puede cambiar el día operativo de caja." },
        { status: 403 }
      );
    }

    const { sessionId } = await params;
    const body = await req.json();
    const shiftDate = String(body?.shiftDate || "").trim();
    const receptionistId = String(
      body?.receptionistId || body?.changedByReceptionistId || ""
    ).trim();
    const pin = String(body?.pin || "").trim();

    if (!shiftDate) {
      return NextResponse.json(
        { error: "Selecciona el día operativo de caja." },
        { status: 400 }
      );
    }

    if (!parseSpanishShortDateLabel(shiftDate)) {
      return NextResponse.json(
        { error: 'Formato de fecha inválido. Usa el formato "4 Jul, 2026".' },
        { status: 400 }
      );
    }

    await connectMongo();

    const session = await PosCashSession.findOne({ sessionCode: sessionId });

    if (!session) {
      return NextResponse.json({ error: "Turno de caja no encontrado" }, { status: 404 });
    }

    if (session.status !== "open") {
      return NextResponse.json(
        { error: "Solo se puede cambiar el día en un turno abierto." },
        { status: 409 }
      );
    }

    if (session.shiftDate === shiftDate) {
      return NextResponse.json(mapCashSessionDoc(session));
    }

    let verified;
    try {
      verified = await verifyReceptionistPin(receptionistId, pin);
    } catch (authError) {
      await logCashRegisterAudit({
        action: "caja_shift_date",
        receptionistId,
        success: false,
        cashSessionCode: sessionId,
        errorMessage: authError.message,
      });
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    const previousShiftDate = session.shiftDate;

    const updated = await PosCashSession.findOneAndUpdate(
      { sessionCode: sessionId },
      { $set: { shiftDate } },
      { new: true }
    );

    await logCashRegisterAudit({
      action: "caja_shift_date",
      receptionistId: verified.receptionistId,
      receptionistName: verified.receptionistName,
      success: true,
      isMaster: verified.isMaster,
      cashSessionCode: sessionId,
      actionDetails: {
        previousShiftDate,
        shiftDate,
      },
    });

    return NextResponse.json(mapCashSessionDoc(updated));
  } catch (error) {
    console.error("PATCH /api/pos/cash-sessions/[sessionId]/shift-date", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cambiar el día de caja" },
      { status: 500 }
    );
  }
}
