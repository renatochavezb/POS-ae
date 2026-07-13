import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapExpenseCategoryDoc } from "@/libs/posMappers";
import { seedPosExpenseCategoriesIfEmpty } from "@/libs/posAdminSeed";
import PosExpenseCategory from "@/models/PosExpenseCategory";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();
    await seedPosExpenseCategoriesIfEmpty();

    const categories = await PosExpenseCategory.find({ isActive: true }).sort({ name: 1 });
    return NextResponse.json(categories.map(mapExpenseCategoryDoc));
  } catch (error) {
    console.error("GET /api/pos/expense-categories", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar las categorías de gasto" },
      { status: 500 }
    );
  }
}
