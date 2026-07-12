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

/** Sesión iniciada desde el perfil Manicuristas (incluye PIN master en ese terminal). */
export function isManicuristaSessionRequest(req) {
  return Boolean((req.headers.get("x-pos-staff-id") || "").trim());
}

/** Bloquea mutaciones de agenda que solo recepción/supervisión/admin pueden hacer. */
export function rejectManicuristaAgendaMutation(req, action = "modificar la agenda") {
  if (!isManicuristaSessionRequest(req)) return null;

  return NextResponse.json(
    { error: `Las manicuristas no pueden ${action}. Usa recepción o supervisión.` },
    { status: 403 }
  );
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
