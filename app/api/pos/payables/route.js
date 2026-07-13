import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { rejectUnauthorizedAdmin } from "@/libs/posAdminAuth";
import { generateNextPayableCode } from "@/libs/posAdminCodes";
import { mapPayableDoc } from "@/libs/posMappers";
import PosPayable from "@/models/PosPayable";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();

    const payables = await PosPayable.find().sort({ dueDate: 1, createdAt: -1 });
    return NextResponse.json(payables.map(mapPayableDoc));
  } catch (error) {
    console.error("GET /api/pos/payables", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar las cuentas por pagar" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const access = rejectUnauthorizedAdmin(req, ["master", "accountant", "reception"]);
    if (access.error) return access.error;

    const body = await req.json();
    const supplierName = String(body?.supplierName || "").trim();
    const concept = String(body?.concept || "").trim();
    const amount = Number(body?.amount);
    const dueDate = String(body?.dueDate || "").trim();

    if (!supplierName || !concept || !dueDate) {
      return NextResponse.json(
        { error: "Proveedor, concepto y fecha de vencimiento son obligatorios" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Ingresa un monto válido mayor a cero" },
        { status: 400 }
      );
    }

    await connectMongo();

    const payableCode = await generateNextPayableCode();

    const created = await PosPayable.create({
      payableCode,
      supplierCode: body.supplierCode || "",
      supplierName,
      concept,
      amount,
      dueDate,
      status: body.status || "pendiente",
      linkedExpenseCode: body.linkedExpenseCode || "",
      linkedPurchaseCode: body.linkedPurchaseCode || "",
      notes: body.notes || "",
      recordedByRole: access.actor.role,
      recordedById: access.actor.id,
      recordedByName: access.actor.name,
    });

    return NextResponse.json(mapPayableDoc(created), { status: 201 });
  } catch (error) {
    console.error("POST /api/pos/payables", error);
    return NextResponse.json(
      { error: error.message || "No se pudo registrar la cuenta por pagar" },
      { status: 500 }
    );
  }
}
