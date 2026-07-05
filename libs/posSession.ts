export type PosSessionRole = "reception" | "manicurista";

export type PosSession = {
  role: PosSessionRole;
  staffId?: string;
  receptionistId?: string;
  isMaster?: boolean;
};

const POS_SESSION_KEY = "posSession";

export function readPosSession(): PosSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(POS_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PosSession;
      if (parsed.role === "reception" || parsed.role === "manicurista") {
        return parsed;
      }
    }
  } catch {
    // Ignore malformed session payloads.
  }

  const receptionistId = sessionStorage.getItem("posReceptionistId");
  const isMaster = sessionStorage.getItem("posMasterSession") === "true";

  if (receptionistId || isMaster) {
    return {
      role: "reception",
      receptionistId: receptionistId || undefined,
      isMaster,
    };
  }

  return null;
}

export function writePosSession(session: PosSession): void {
  sessionStorage.setItem(POS_SESSION_KEY, JSON.stringify(session));

  if (session.isMaster) {
    sessionStorage.setItem("posMasterSession", "true");
  } else {
    sessionStorage.removeItem("posMasterSession");
  }

  if (session.role === "reception" && session.receptionistId) {
    sessionStorage.setItem("posReceptionistId", session.receptionistId);
  } else {
    sessionStorage.removeItem("posReceptionistId");
  }
}

export function clearPosSession(): void {
  sessionStorage.removeItem(POS_SESSION_KEY);
  sessionStorage.removeItem("posReceptionistId");
  sessionStorage.removeItem("posMasterSession");
}

/** Recepcionista activa para registrar citas (null si entró como manicurista). */
export function getActiveReceptionistSession(): {
  id: string;
  isMaster: boolean;
} | null {
  const session = readPosSession();
  if (!session || session.role !== "reception" || !session.receptionistId) {
    return null;
  }

  return {
    id: session.receptionistId,
    isMaster: Boolean(session.isMaster),
  };
}
