import dns from "dns";

let configured = false;

/**
 * Algunos entornos (p. ej. Cursor en Windows) bloquean consultas SRV del DNS local.
 * MongoDB Atlas usa mongodb+srv, así que forzamos resolvers públicos antes de conectar.
 */
export function configureMongoDns() {
  if (configured) return;

  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  configured = true;
}
