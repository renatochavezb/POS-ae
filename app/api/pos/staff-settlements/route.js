import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapStaffSettlementDoc } from "@/libs/posMappers";
import PosStaffSettlement from "@/models/PosStaffSettlement";
import PosAccountant from "@/models/PosAccountant";
import { seedPosAccountantIfEmpty } from "@/libs/posSeed";
import { logSettlementAudit, verifyAccountantPin } from "@/libs/posAccountantAuth";
import { recordAccountantActivity } from "@/libs/posAccountantActivity";
import { createStaffSettlement } from "@/libs/posStaffSettlement";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const body = await req.json();
    const staffId = String(body?.staffId || "").trim().toUpperCase();
    const periodMode = body?.periodMode === "period" ? "period" : "day";
    const periodStartLabel = String(body?.periodStartLabel || "").trim();
    const periodEndLabel = String(body?.periodEndLabel || "").trim();
    const periodStartYmd = String(body?.periodStartYmd || "").trim();
    const periodEndYmd = String(body?.periodEndYmd || "").trim();
    const accountantId = String(body?.accountantId || "").trim().toUpperCase();
    const pin = String(body?.pin || "").trim();
    const accountantSession = body?.accountantSession === true;
    const notes = String(body?.notes || "").trim();

    if (
      !staffId ||
      !periodStartLabel ||
      !periodEndLabel ||
      !periodStartYmd ||
      !periodEndYmd ||
      !accountantId
    ) {
      return NextResponse.json(
        { error: "Faltan datos del periodo o de la manicurista" },
        { status: 400 }
      );
    }

    await connectMongo();
    await seedPosAccountantIfEmpty();

    let verified;
    try {
      if (accountantSession) {
        const accountant = await PosAccountant.findOne({
          accountantCode: accountantId,
          isActive: { $ne: false },
        });

        if (!accountant) {
          throw new Error("Contadora no encontrada");
        }

        verified = {
          accountantId: accountant.accountantCode,
          accountantName: accountant.name,
          isMaster: false,
        };
      } else {
        verified = await verifyAccountantPin(accountantId, pin);
      }
    } catch (error) {
      await logSettlementAudit({
        action: "staff_settlement",
        accountantId,
        staffId,
        success: false,
        errorMessage: error.message,
      });
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const created = await createStaffSettlement({
      staffId,
      periodMode,
      periodStartLabel,
      periodEndLabel,
      periodStartYmd,
      periodEndYmd,
      accountantId: verified.accountantId,
      accountantName: verified.accountantName,
      notes,
    });

    const settlementAudit = await logSettlementAudit({
      action: "staff_settlement",
      accountantId: verified.accountantId,
      accountantName: verified.accountantName,
      staffId,
      staffName: created.staffName,
      success: true,
      isMaster: verified.isMaster,
      actionDetails: {
        settlementCode: created.settlementCode,
        periodStartLabel,
        periodEndLabel,
        paidAmount: created.paidAmount,
      },
    });

    const loginAuditId = settlementAudit?._id?.toString() || "";
    if (loginAuditId) {
      await PosStaffSettlement.updateOne(
        { settlementCode: created.settlementCode },
        { $set: { loginAuditId } }
      );
      created.loginAuditId = loginAuditId;
    }

    await recordAccountantActivity({
      accountantId: verified.accountantId,
      action: "liquidation",
      staffId: created.staffId,
      staffName: created.staffName,
      periodMode,
      periodStartLabel: created.periodStartLabel,
      periodEndLabel: created.periodEndLabel,
      periodStartYmd: created.periodStartYmd,
      periodEndYmd: created.periodEndYmd,
      settlementCode: created.settlementCode,
      appointmentCount: created.appointmentCount,
      grossAmount: created.grossAmount,
      paidAmount: created.paidAmount,
      appointmentCodes: created.appointmentCodes,
      paymentCodes: created.paymentCodes,
      cashSessionCodes: created.cashSessionCodes,
      loginAuditId,
      isMasterSession: verified.isMaster,
      activityAt: created.settledAt,
    });

    return NextResponse.json(mapStaffSettlementDoc(created), { status: 201 });
  } catch (error) {
    console.error("POST /api/pos/staff-settlements", error);

    if (error.message?.includes("ya fue liquidado")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: error.message || "No se pudo registrar la liquidación" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();

    const settlements = await PosStaffSettlement.find()
      .sort({ settledAt: -1 })
      .limit(200);

    return NextResponse.json(settlements.map(mapStaffSettlementDoc));
  } catch (error) {
    console.error("GET /api/pos/staff-settlements", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar liquidaciones" },
      { status: 500 }
    );
  }
}
