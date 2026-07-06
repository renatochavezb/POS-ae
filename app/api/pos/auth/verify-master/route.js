import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { getScheduleConfig } from "@/libs/posScheduleConfig";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const body = await req.json();
    const pin = String(body?.pin || "").trim();

    if (pin.length !== 4) {
      return NextResponse.json({ error: "Ingresa la clave de 4 dígitos" }, { status: 400 });
    }

    await connectMongo();
    const scheduleConfig = await getScheduleConfig();
    const masterLoginCode = scheduleConfig.masterLoginCode || "0000";

    if (pin !== masterLoginCode) {
      return NextResponse.json({ error: "Clave de admin incorrecta" }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/pos/auth/verify-master", error);
    return NextResponse.json(
      { error: error.message || "No se pudo validar la clave" },
      { status: 500 }
    );
  }
}
