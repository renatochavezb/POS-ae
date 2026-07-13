import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import {
  canActorUseCategory,
  rejectUnauthorizedAdmin,
  resolveAdminActor,
} from "@/libs/posAdminAuth";
import { generateNextExpenseCode } from "@/libs/posAdminCodes";
import { seedPosAdminIfEmpty } from "@/libs/posAdminSeed";
import { mapExpenseDoc } from "@/libs/posMappers";
import PosExpense from "@/models/PosExpense";
import PosExpenseCategory from "@/models/PosExpenseCategory";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const actor = resolveAdminActor(req);
    if (!actor) {
      return NextResponse.json({ error: "Sesión POS requerida" }, { status: 401 });
    }

    await connectMongo();
    await seedPosAdminIfEmpty();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const categoryCode = searchParams.get("categoryCode");

    const filter = {};
    if (status) filter.status = status;
    if (categoryCode) filter.categoryCode = String(categoryCode).toUpperCase();

    const expenses = await PosExpense.find(filter).sort({ expenseDate: -1, createdAt: -1 });
    return NextResponse.json(expenses.map(mapExpenseDoc));
  } catch (error) {
    console.error("GET /api/pos/expenses", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar los gastos" },
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
    const categoryCode = String(body?.categoryCode || "").trim().toUpperCase();
    const description = String(body?.description || "").trim();
    const amount = Number(body?.amount);

    if (!categoryCode || !description) {
      return NextResponse.json(
        { error: "Categoría y descripción son obligatorias" },
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
    await seedPosAdminIfEmpty();

    const category = await PosExpenseCategory.findOne({ categoryCode, isActive: true });
    if (!category) {
      return NextResponse.json({ error: "Categoría de gasto no encontrada" }, { status: 404 });
    }

    if (!canActorUseCategory(access.actor, category.allowedRoles)) {
      return NextResponse.json(
        { error: "Esta categoría solo puede registrarse desde contabilidad" },
        { status: 403 }
      );
    }

    const expenseCode = await generateNextExpenseCode();

    const created = await PosExpense.create({
      expenseCode,
      categoryCode: category.categoryCode,
      categoryName: category.name,
      description,
      amount,
      expenseDate: body.expenseDate || getTodaySpanishShortDate(),
      paymentMethod: body.paymentMethod || "efectivo",
      status: body.status || "pagado",
      supplierCode: body.supplierCode || "",
      supplierName: body.supplierName || "",
      receiptReference: body.receiptReference || "",
      notes: body.notes || "",
      recordedByRole: access.actor.role,
      recordedById: access.actor.id,
      recordedByName: access.actor.name,
      approvedByAccountantId: access.actor.isAccountant ? access.actor.id : "",
      cashSessionCode: body.cashSessionCode || "",
    });

    return NextResponse.json(mapExpenseDoc(created), { status: 201 });
  } catch (error) {
    console.error("POST /api/pos/expenses", error);
    return NextResponse.json(
      { error: error.message || "No se pudo registrar el gasto" },
      { status: 500 }
    );
  }
}
