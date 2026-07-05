import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapReceptionistDoc } from "@/libs/posMappers";
import PosReceptionist from "@/models/PosReceptionist";
import {
  seedPosReceptionistsIfEmpty,
  refreshReceptionistDailyCounts,
} from "@/libs/posSeed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();
    await seedPosReceptionistsIfEmpty();
    await refreshReceptionistDailyCounts();

    const receptionists = await PosReceptionist.find().sort({ name: 1 });
    return NextResponse.json(receptionists.map(mapReceptionistDoc));
  } catch (error) {
    console.error("GET /api/pos/receptionists", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar recepción" },
      { status: 500 }
    );
  }
}
