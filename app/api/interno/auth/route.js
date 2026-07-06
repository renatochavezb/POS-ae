import { NextResponse } from "next/server";
import {
  clearInternoCookie,
  getInternoSession,
  setInternoCookie,
} from "@/libs/internoAuth";
import {
  formatMongoErrorForUser,
  isMongoConnectionError,
  resolveMasterLoginCode,
} from "@/libs/internoMasterPin";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getInternoSession();
  return NextResponse.json({ authenticated: Boolean(session) });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const pin = String(body?.pin || "").trim();

    if (pin.length !== 4) {
      return NextResponse.json(
        { error: "Ingresa la clave de administrador de 4 dígitos" },
        { status: 400 }
      );
    }

    const masterLoginCode = await resolveMasterLoginCode();

    if (pin !== masterLoginCode) {
      return NextResponse.json(
        { error: "Clave de administrador incorrecta" },
        { status: 401 }
      );
    }

    await setInternoCookie();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/interno/auth", error);
    const status = isMongoConnectionError(error) ? 503 : 500;
    return NextResponse.json(
      {
        error: formatMongoErrorForUser(error),
        code: isMongoConnectionError(error) ? "MONGO_UNAVAILABLE" : "AUTH_ERROR",
      },
      { status }
    );
  }
}
export async function DELETE() {
  await clearInternoCookie();
  return NextResponse.json({ success: true });
}
