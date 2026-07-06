import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapAccountantDoc } from "@/libs/posMappers";
import PosAccountant from "@/models/PosAccountant";
import { seedPosAccountantIfEmpty } from "@/libs/posSeed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();
    await seedPosAccountantIfEmpty();

    const accountants = await PosAccountant.find({ isActive: { $ne: false } }).sort({
      name: 1,
    });

    return NextResponse.json(accountants.map(mapAccountantDoc));
  } catch (error) {
    console.error("GET /api/pos/accountants", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar contabilidad" },
      { status: 500 }
    );
  }
}
