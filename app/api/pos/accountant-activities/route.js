import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapAccountantActivityDoc } from "@/libs/posMappers";
import PosAccountantActivity from "@/models/PosAccountantActivity";
import { recordAccountantActivity } from "@/libs/posAccountantActivity";

export const dynamic = "force-dynamic";

const ALLOWED_ACTIONS = new Set(["login", "logout", "report_download", "liquidation"]);

export async function GET(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();

    const { searchParams } = new URL(req.url);
    const accountantId = String(searchParams.get("accountantId") || "")
      .trim()
      .toUpperCase();
    const staffId = String(searchParams.get("staffId") || "").trim().toUpperCase();
    const action = String(searchParams.get("action") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit") || 100), 300);

    const query = {};
    if (accountantId) query.accountantId = accountantId;
    if (staffId) query.staffId = staffId;
    if (action && ALLOWED_ACTIONS.has(action)) query.action = action;

    const activities = await PosAccountantActivity.find(query)
      .sort({ activityAt: -1 })
      .limit(limit);

    return NextResponse.json(activities.map(mapAccountantActivityDoc));
  } catch (error) {
    console.error("GET /api/pos/accountant-activities", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar la actividad de contabilidad" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const body = await req.json();
    const action = String(body?.action || "").trim();

    if (!ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
    }

    const accountantId = String(body?.accountantId || "").trim().toUpperCase();
    if (!accountantId) {
      return NextResponse.json(
        { error: "accountantId es obligatorio" },
        { status: 400 }
      );
    }

    await connectMongo();

    const created = await recordAccountantActivity({
      accountantId,
      action,
      staffId: body?.staffId,
      staffName: body?.staffName,
      periodMode: body?.periodMode,
      periodStartLabel: body?.periodStartLabel,
      periodEndLabel: body?.periodEndLabel,
      periodStartYmd: body?.periodStartYmd,
      periodEndYmd: body?.periodEndYmd,
      settlementCode: body?.settlementCode,
      reportCode: body?.reportCode,
      appointmentCount: body?.appointmentCount,
      grossAmount: body?.grossAmount,
      paidAmount: body?.paidAmount,
      appointmentCodes: body?.appointmentCodes,
      paymentCodes: body?.paymentCodes,
      cashSessionCodes: body?.cashSessionCodes,
      reportSnapshot: body?.reportSnapshot,
      loginAuditId: body?.loginAuditId,
      logoutReason: body?.logoutReason,
      isMasterSession: body?.isMasterSession,
      metadata: body?.metadata,
    });

    return NextResponse.json(mapAccountantActivityDoc(created), { status: 201 });
  } catch (error) {
    console.error("POST /api/pos/accountant-activities", error);
    return NextResponse.json(
      { error: error.message || "No se pudo registrar la actividad" },
      { status: 500 }
    );
  }
}
