import { NextResponse } from "next/server";

// El POS usa autenticación local por PIN en el cliente.
// No requiere sesión NextAuth para acceder a las APIs del salón.
export async function requirePosSession() {
  return { session: null };
}

/** Solo sesión con PIN master (administrador). */
export function isMasterSessionRequest(req) {
  return req.headers.get("x-pos-master-session") === "true";
}

/** Solo sesión con PIN master (administrador). */
export function requireMasterSession(req) {
  if (!isMasterSessionRequest(req)) {
    return {
      error: NextResponse.json(
        { error: "Solo el administrador puede consultar la bitácora de contabilidad" },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}
