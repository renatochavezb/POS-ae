import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import {
  getScheduleConfig,
  updateScheduleConfig,
} from "@/libs/posScheduleConfig";

export const dynamic = "force-dynamic";

function stripSensitiveConfig(config) {
  const { masterLoginCode: _masterLoginCode, ...safe } = config;
  return safe;
}

export async function GET() {
  try {
    await connectMongo();
    const config = await getScheduleConfig();
    return NextResponse.json(stripSensitiveConfig(config));
  } catch (error) {
    console.error("GET /api/pos/schedule-config", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar la configuración del horario" },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const pin = String(body?.pin || "").trim();
    const weeklyHours = body?.weeklyHours;

    if (pin.length !== 4) {
      return NextResponse.json(
        { error: "Ingresa la clave de administrador de 4 dígitos" },
        { status: 400 }
      );
    }

    if (!weeklyHours) {
      return NextResponse.json(
        { error: "Faltan los horarios semanales" },
        { status: 400 }
      );
    }

    await connectMongo();
    const config = await updateScheduleConfig({
      pin,
      weeklyHours,
      cabinCapacity: body?.cabinCapacity,
    });

    return NextResponse.json(stripSensitiveConfig(config));
  } catch (error) {
    console.error("PATCH /api/pos/schedule-config", error);

    const message = error.message || "No se pudo guardar la configuración del horario";
    const status = message.includes("Clave de administrador") ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
