import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapStaffSettlementDoc } from "@/libs/posMappers";
import PosStaffSettlement from "@/models/PosStaffSettlement";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const { staffId } = await params;

    await connectMongo();

    const settlements = await PosStaffSettlement.find({
      staffId: String(staffId).trim().toUpperCase(),
    }).sort({ settledAt: -1 });

    return NextResponse.json(settlements.map(mapStaffSettlementDoc));
  } catch (error) {
    console.error("GET /api/pos/staff/[staffId]/settlements", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar liquidaciones de la manicurista" },
      { status: 500 }
    );
  }
}
