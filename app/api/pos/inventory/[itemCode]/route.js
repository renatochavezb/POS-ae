import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { rejectUnauthorizedAdmin } from "@/libs/posAdminAuth";
import { mapInventoryItemDoc } from "@/libs/posMappers";
import PosInventoryItem from "@/models/PosInventoryItem";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const access = rejectUnauthorizedAdmin(req, ["master", "accountant", "reception"]);
    if (access.error) return access.error;

    const itemCode = String(params?.itemCode || "").trim().toUpperCase();
    const body = await req.json();
    const adjustment = Number(body?.stockAdjustment);

    if (!itemCode) {
      return NextResponse.json({ error: "Artículo no encontrado" }, { status: 404 });
    }

    if (!Number.isFinite(adjustment) || adjustment === 0) {
      return NextResponse.json(
        { error: "Indica un ajuste de stock válido (positivo o negativo)" },
        { status: 400 }
      );
    }

    await connectMongo();

    const item = await PosInventoryItem.findOne({ itemCode, isActive: true });
    if (!item) {
      return NextResponse.json({ error: "Artículo no encontrado" }, { status: 404 });
    }

    const nextStock = Math.max(0, (item.currentStock || 0) + adjustment);
    item.currentStock = nextStock;
    if (adjustment > 0) item.lastRestockedAt = new Date();
    if (body.notes) {
      item.notes = String(body.notes).trim();
    }
    await item.save();

    return NextResponse.json(mapInventoryItemDoc(item));
  } catch (error) {
    console.error("PATCH /api/pos/inventory/[itemCode]", error);
    return NextResponse.json(
      { error: error.message || "No se pudo actualizar el inventario" },
      { status: 500 }
    );
  }
}
