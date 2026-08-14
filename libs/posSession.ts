export type PosSessionRole = "reception" | "manicurista" | "accountant" | "marketing";

export type PosSession = {
  role: PosSessionRole;
  staffId?: string;
  receptionistId?: string;
  accountantId?: string;
  accountantName?: string;
  agencyId?: string;
  agencyName?: string;
  isMaster?: boolean;
};

const POS_SESSION_KEY = "posSession";
const POS_ACCOUNTANT_LOGOUT_FLAG = "posAccountantLogoutRecorded";

export function markAccountantLogoutRecorded(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(POS_ACCOUNTANT_LOGOUT_FLAG, "1");
}

export function wasAccountantLogoutRecorded(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(POS_ACCOUNTANT_LOGOUT_FLAG) === "1";
}

export function clearAccountantLogoutRecorded(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(POS_ACCOUNTANT_LOGOUT_FLAG);
}

export function readPosSession(): PosSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(POS_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PosSession;
      if (
        parsed.role === "reception" ||
        parsed.role === "manicurista" ||
        parsed.role === "accountant" ||
        parsed.role === "marketing"
      ) {
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
  clearAccountantLogoutRecorded();
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

  if (session.role === "accountant" && session.accountantId) {
    sessionStorage.setItem("posAccountantId", session.accountantId);
  } else {
    sessionStorage.removeItem("posAccountantId");
  }

  if (session.role === "marketing" && session.agencyId) {
    sessionStorage.setItem("posAgencyId", session.agencyId);
  } else {
    sessionStorage.removeItem("posAgencyId");
  }
}

export function clearPosSession(): void {
  sessionStorage.removeItem(POS_SESSION_KEY);
  sessionStorage.removeItem("posReceptionistId");
  sessionStorage.removeItem("posAccountantId");
  sessionStorage.removeItem("posAgencyId");
  sessionStorage.removeItem("posMasterSession");
}

/** Contadora activa (null si no entró como contabilidad). */
export function getActiveAccountantSession(): { id: string; name?: string } | null {
  const session = readPosSession();
  if (!session || session.role !== "accountant" || !session.accountantId) {
    return null;
  }

  return {
    id: session.accountantId,
    name: session.accountantName,
  };
}

/** Agencia de mercadotecnia activa. */
export function getActiveMarketingAgencySession(): { id: string; name?: string } | null {
  const session = readPosSession();
  if (!session || session.role !== "marketing" || !session.agencyId) {
    return null;
  }

  return {
    id: session.agencyId,
    name: session.agencyName,
  };
}

/** Recepcionista activa para registrar citas (null si entró como manicurista o contadora). */
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
