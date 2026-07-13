import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { rejectUnauthorizedAdmin } from "@/libs/posAdminAuth";
import { generateNextInventoryItemCode, generateNextPurchaseCode } from "@/libs/posAdminCodes";
import { mapPurchaseDoc } from "@/libs/posMappers";
import PosInventoryItem from "@/models/PosInventoryItem";
import PosPurchase from "@/models/PosPurchase";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();

    const purchases = await PosPurchase.find().sort({ purchaseDate: -1, createdAt: -1 });
    return NextResponse.json(purchases.map(mapPurchaseDoc));
  } catch (error) {
    console.error("GET /api/pos/purchases", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar las compras" },
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
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!supplierName) {
      return NextResponse.json({ error: "El proveedor es obligatorio" }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Agrega al menos un artículo a la compra" },
        { status: 400 }
      );
    }

    const normalizedItems = items.map((line) => {
      const quantity = Number(line?.quantity);
      const unitCost = Number(line?.unitCost);
      const name = String(line?.name || "").trim();

      if (!name || !Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Cada línea debe tener nombre y cantidad válida");
      }

      const safeUnitCost = Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : 0;
      return {
        itemCode: String(line?.itemCode || "").trim(),
        name,
        quantity,
        unitCost: safeUnitCost,
        subtotal: quantity * safeUnitCost,
      };
    });

    const subtotal = normalizedItems.reduce((sum, line) => sum + line.subtotal, 0);
    const tax = Number(body?.tax ?? 0);
    const safeTax = Number.isFinite(tax) && tax >= 0 ? tax : 0;
    const total = subtotal + safeTax;

    await connectMongo();

    const purchaseCode = await generateNextPurchaseCode();

    const created = await PosPurchase.create({
      purchaseCode,
      supplierCode: body.supplierCode || "",
      supplierName,
      purchaseDate: body.purchaseDate || getTodaySpanishShortDate(),
      items: normalizedItems,
      subtotal,
      tax: safeTax,
      total,
      status: body.status || "recibida",
      paymentStatus: body.paymentStatus || "pendiente",
      notes: body.notes || "",
      recordedByRole: access.actor.role,
      recordedById: access.actor.id,
      recordedByName: access.actor.name,
    });

    for (const line of normalizedItems) {
      if (line.itemCode) {
        const existing = await PosInventoryItem.findOne({ itemCode: line.itemCode });
        if (existing) {
          existing.currentStock = (existing.currentStock || 0) + line.quantity;
          existing.lastRestockedAt = new Date();
          if (line.unitCost > 0) existing.unitCost = line.unitCost;
          await existing.save();
          continue;
        }
      }

      const itemCode = line.itemCode || (await generateNextInventoryItemCode());
      await PosInventoryItem.create({
        itemCode,
        name: line.name,
        category: "consumibles",
        unit: "pieza",
        currentStock: line.quantity,
        minStock: 0,
        unitCost: line.unitCost,
        supplierCode: body.supplierCode || "",
        supplierName,
        lastRestockedAt: new Date(),
        recordedByRole: access.actor.role,
        recordedById: access.actor.id,
        recordedByName: access.actor.name,
      });
    }

    return NextResponse.json(mapPurchaseDoc(created), { status: 201 });
  } catch (error) {
    console.error("POST /api/pos/purchases", error);
    return NextResponse.json(
      { error: error.message || "No se pudo registrar la compra" },
      { status: 500 }
    );
  }
}
