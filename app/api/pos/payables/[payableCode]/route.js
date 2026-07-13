import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { rejectUnauthorizedAdmin } from "@/libs/posAdminAuth";
import { mapPayableDoc } from "@/libs/posMappers";
import PosPayable from "@/models/PosPayable";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const access = rejectUnauthorizedAdmin(req, ["master", "accountant", "reception"]);
    if (access.error) return access.error;

    const payableCode = String(params?.payableCode || "").trim();
    const body = await req.json();
    const status = String(body?.status || "").trim();

    if (!payableCode) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    await connectMongo();

    const payable = await PosPayable.findOne({ payableCode });
    if (!payable) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    if (status === "pagada") {
      payable.status = "pagada";
      payable.paidAt = new Date();
      payable.paidAmount = Number(body?.paidAmount ?? payable.amount) || payable.amount;
    } else if (status) {
      payable.status = status;
    }

    if (body.notes !== undefined) {
      payable.notes = String(body.notes || "").trim();
    }

    await payable.save();
    return NextResponse.json(mapPayableDoc(payable));
  } catch (error) {
    console.error("PATCH /api/pos/payables/[payableCode]", error);
    return NextResponse.json(
      { error: error.message || "No se pudo actualizar la cuenta por pagar" },
      { status: 500 }
    );
  }
}
