import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { getScheduleConfig } from "@/libs/posScheduleConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectMongo();
    const config = await getScheduleConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("GET /api/pos/schedule-config", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar la configuración del horario" },
      { status: 500 }
    );
  }
}
