import { NextResponse } from "next/server";
import { isMasterSessionRequest } from "@/libs/posAuth";

export function resolveAdminActor(req) {
  const isMaster = isMasterSessionRequest(req);
  const receptionistId = String(req.headers.get("x-pos-receptionist-id") || "").trim();
  const receptionistName = String(req.headers.get("x-pos-receptionist-name") || "").trim();
  const accountantId = String(req.headers.get("x-pos-accountant-id") || "").trim();
  const accountantName = String(req.headers.get("x-pos-accountant-name") || "").trim();

  if (isMaster) {
    return {
      role: "master",
      id: receptionistId || "MASTER",
      name: receptionistName || "Administrador",
      isMaster: true,
      isAccountant: false,
      isReception: true,
    };
  }

  if (accountantId) {
    return {
      role: "accountant",
      id: accountantId,
      name: accountantName || "Contadora",
      isMaster: false,
      isAccountant: true,
      isReception: false,
    };
  }

  if (receptionistId) {
    return {
      role: "reception",
      id: receptionistId,
      name: receptionistName || "Recepción",
      isMaster: false,
      isAccountant: false,
      isReception: true,
    };
  }

  return null;
}

export function rejectUnauthorizedAdmin(req, allowedRoles = ["master", "accountant", "reception"]) {
  const actor = resolveAdminActor(req);

  if (!actor) {
    return {
      error: NextResponse.json(
        { error: "Sesión POS requerida para administración" },
        { status: 401 }
      ),
    };
  }

  if (!allowedRoles.includes(actor.role)) {
    return {
      error: NextResponse.json(
        { error: "No tienes permiso para esta acción de administración" },
        { status: 403 }
      ),
    };
  }

  return { actor };
}

export function canActorUseCategory(actor, categoryAllowedRoles) {
  if (actor.isMaster) return true;
  if (categoryAllowedRoles === "both") return true;
  if (categoryAllowedRoles === "reception") return actor.isReception;
  if (categoryAllowedRoles === "accountant") return actor.isAccountant;
  return false;
}
