import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import PosService from "@/models/PosService";
import { mapServiceDoc } from "@/libs/posMappers";
import { buildServiceSeedDocs } from "@/libs/posServiceSeed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();

    let services = await PosService.find({ isActive: { $ne: false } }).sort({
      category: 1,
      name: 1,
    });

    if (services.length === 0) {
      const seedDocs = buildServiceSeedDocs();
      await PosService.insertMany(seedDocs);
      services = await PosService.find({ isActive: { $ne: false } }).sort({
        category: 1,
        name: 1,
      });
    }

    return NextResponse.json(services.map(mapServiceDoc));
  } catch (error) {
    console.error("GET /api/pos/services", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar el catálogo de servicios" },
      { status: 500 }
    );
  }
}
