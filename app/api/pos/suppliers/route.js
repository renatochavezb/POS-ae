import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { rejectUnauthorizedAdmin } from "@/libs/posAdminAuth";
import { generateNextSupplierCode } from "@/libs/posAdminCodes";
import { seedPosSuppliersIfEmpty } from "@/libs/posAdminSeed";
import { mapSupplierDoc } from "@/libs/posMappers";
import PosSupplier from "@/models/PosSupplier";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();
    await seedPosSuppliersIfEmpty();

    const suppliers = await PosSupplier.find({ isActive: true }).sort({ name: 1 });
    return NextResponse.json(suppliers.map(mapSupplierDoc));
  } catch (error) {
    console.error("GET /api/pos/suppliers", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar los proveedores" },
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
    const name = String(body?.name || "").trim();

    if (!name) {
      return NextResponse.json({ error: "El nombre del proveedor es obligatorio" }, { status: 400 });
    }

    await connectMongo();

    const supplierCode = await generateNextSupplierCode();

    const created = await PosSupplier.create({
      supplierCode,
      name,
      contactName: body.contactName || "",
      phone: body.phone || "",
      email: body.email || "",
      taxId: body.taxId || "",
      category: body.category || "general",
      paymentTerms: body.paymentTerms || "",
      notes: body.notes || "",
      recordedByRole: access.actor.role,
      recordedById: access.actor.id,
      recordedByName: access.actor.name,
    });

    return NextResponse.json(mapSupplierDoc(created), { status: 201 });
  } catch (error) {
    console.error("POST /api/pos/suppliers", error);
    return NextResponse.json(
      { error: error.message || "No se pudo registrar el proveedor" },
      { status: 500 }
    );
  }
}
