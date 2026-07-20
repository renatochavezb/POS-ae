import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import PosService from "@/models/PosService";
import { mapServiceDoc } from "@/libs/posMappers";
import {
  buildLegacyServiceSeedDocs,
  ensurePriceListServices,
} from "@/libs/posServiceSeed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();

    let count = await PosService.countDocuments();
    if (count === 0) {
      await PosService.insertMany(buildLegacyServiceSeedDocs());
    }

    await ensurePriceListServices(PosService);

    const services = await PosService.find({ isActive: { $ne: false } }).sort({
      sortOrder: 1,
      name: 1,
    });

    return NextResponse.json(services.map(mapServiceDoc));
  } catch (error) {
    console.error("GET /api/pos/services", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar el catálogo de servicios" },
      { status: 500 }
    );
  }
}
