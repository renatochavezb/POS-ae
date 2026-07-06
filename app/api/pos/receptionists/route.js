import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession, isMasterSessionRequest } from "@/libs/posAuth";
import { mapReceptionistDoc } from "@/libs/posMappers";
import PosReceptionist from "@/models/PosReceptionist";
import {
  seedPosReceptionistsIfEmpty,
  refreshReceptionistDailyCounts,
  syncReceptionistLoginCodes,
} from "@/libs/posSeed";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const includeSensitive = isMasterSessionRequest(req);

    await connectMongo();
    await seedPosReceptionistsIfEmpty();
    await syncReceptionistLoginCodes();
    await refreshReceptionistDailyCounts();

    const receptionists = await PosReceptionist.find().sort({ name: 1 });
    return NextResponse.json(
      receptionists.map((doc) => {
        const mapped = mapReceptionistDoc(doc);
        if (!includeSensitive) {
          const { loginCode: _loginCode, ...safe } = mapped;
          return safe;
        }
        return mapped;
      })
    );
  } catch (error) {
    console.error("GET /api/pos/receptionists", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar recepción" },
      { status: 500 }
    );
  }
}
