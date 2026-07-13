import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { rejectUnauthorizedAdmin } from "@/libs/posAdminAuth";
import { generateNextInventoryItemCode } from "@/libs/posAdminCodes";
import { seedPosInventoryIfEmpty } from "@/libs/posAdminSeed";
import { mapInventoryItemDoc } from "@/libs/posMappers";
import PosInventoryCategory from "@/models/PosInventoryCategory";
import PosInventoryItem from "@/models/PosInventoryItem";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();
    await seedPosInventoryIfEmpty();

    const items = await PosInventoryItem.find({ isActive: true }).sort({ name: 1 });
    return NextResponse.json(items.map(mapInventoryItemDoc));
  } catch (error) {
    console.error("GET /api/pos/inventory", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar el inventario" },
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
      return NextResponse.json({ error: "El nombre del artículo es obligatorio" }, { status: 400 });
    }

    await connectMongo();

    const itemCode = await generateNextInventoryItemCode();
    const category = String(body?.category || "consumibles").trim().toLowerCase();
    const categoryExists = await PosInventoryCategory.exists({
      categoryCode: category,
      isActive: true,
    });

    if (!categoryExists) {
      return NextResponse.json(
        { error: "La sección seleccionada no existe en el inventario" },
        { status: 400 }
      );
    }

    const currentStock = Number(body?.currentStock ?? 0);
    const minStock = Number(body?.minStock ?? 0);
    const unitCost = Number(body?.unitCost ?? 0);

    const created = await PosInventoryItem.create({
      itemCode,
      name,
      category,
      system: body.system || "universal",
      brand: body.brand || "",
      shade: body.shade || "",
      unit: body.unit || "pieza",
      currentStock: Number.isFinite(currentStock) ? Math.max(0, currentStock) : 0,
      minStock: Number.isFinite(minStock) ? Math.max(0, minStock) : 0,
      unitCost: Number.isFinite(unitCost) ? Math.max(0, unitCost) : 0,
      supplierCode: body.supplierCode || "",
      supplierName: body.supplierName || "",
      lastRestockedAt: currentStock > 0 ? new Date() : null,
      notes: body.notes || "",
      recordedByRole: access.actor.role,
      recordedById: access.actor.id,
      recordedByName: access.actor.name,
    });

    return NextResponse.json(mapInventoryItemDoc(created), { status: 201 });
  } catch (error) {
    console.error("POST /api/pos/inventory", error);
    return NextResponse.json(
      { error: error.message || "No se pudo registrar el artículo" },
      { status: 500 }
    );
  }
}
