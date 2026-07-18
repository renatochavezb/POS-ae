import dns from "dns";

let configured = false;

/**
 * Algunos entornos (p. ej. Cursor en Windows) bloquean consultas SRV del DNS local.
 * MongoDB Atlas usa mongodb+srv, así que forzamos resolvers públicos antes de conectar.
 */
export function configureMongoDns() {
  if (configured) return;

  try {
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  } catch (err) {
    console.error("[setupDns] setServers failed:", err.message);
  }
  configured = true;
}
