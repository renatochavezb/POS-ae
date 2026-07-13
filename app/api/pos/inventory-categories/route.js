import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { rejectUnauthorizedAdmin } from "@/libs/posAdminAuth";
import { INVENTORY_CATEGORIES } from "@/libs/inventoryCategories";
import PosInventoryCategory from "@/models/PosInventoryCategory";

export const dynamic = "force-dynamic";

const mapCategory = (doc) => {
  const raw = doc.toObject ? doc.toObject() : doc;
  return {
    id: raw.categoryCode,
    label: raw.name,
    description: raw.description || "",
    sortOrder: raw.sortOrder ?? 0,
    isActive: raw.isActive !== false,
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : "",
  };
};

const slugify = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

async function seedInventoryCategories() {
  await PosInventoryCategory.bulkWrite(
    INVENTORY_CATEGORIES.map((category, index) => ({
      updateOne: {
        filter: { categoryCode: category.id },
        update: {
          $setOnInsert: {
            name: category.label,
            description: category.description,
            sortOrder: index,
            recordedByRole: "master",
            recordedByName: "Sistema",
          },
        },
        upsert: true,
      },
    }))
  );
}

export async function GET() {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();
    await seedInventoryCategories();

    const categories = await PosInventoryCategory.find({ isActive: true }).sort({
      sortOrder: 1,
      name: 1,
    });
    return NextResponse.json(categories.map(mapCategory));
  } catch (error) {
    console.error("GET /api/pos/inventory-categories", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar las secciones" },
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
    const description = String(body?.description || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "El nombre de la sección es obligatorio" },
        { status: 400 }
      );
    }

    await connectMongo();
    await seedInventoryCategories();

    const baseCode = slugify(name);
    if (!baseCode) {
      return NextResponse.json(
        { error: "Escribe un nombre válido para la sección" },
        { status: 400 }
      );
    }

    let categoryCode = baseCode;
    let suffix = 2;
    while (await PosInventoryCategory.exists({ categoryCode })) {
      categoryCode = `${baseCode}-${suffix}`;
      suffix += 1;
    }

    const lastCategory = await PosInventoryCategory.findOne().sort({ sortOrder: -1 });
    const created = await PosInventoryCategory.create({
      categoryCode,
      name,
      description,
      sortOrder: (lastCategory?.sortOrder ?? -1) + 1,
      recordedByRole: access.actor.role,
      recordedById: access.actor.id,
      recordedByName: access.actor.name,
    });

    return NextResponse.json(mapCategory(created), { status: 201 });
  } catch (error) {
    console.error("POST /api/pos/inventory-categories", error);
    return NextResponse.json(
      { error: error.message || "No se pudo crear la sección" },
      { status: 500 }
    );
  }
}
