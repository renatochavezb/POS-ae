import connectMongo from "@/libs/mongoose";
import { getScheduleConfig } from "@/libs/posScheduleConfig";

export function getEnvMasterPin() {
  const pin = process.env.POS_MASTER_PIN || process.env.INTERNO_MASTER_PIN;
  return pin ? String(pin).trim() : "";
}

export function isMongoConnectionError(error) {
  if (!error) return false;
  const name = error.name || "";
  const message = String(error.message || "");
  return (
    name === "MongooseServerSelectionError" ||
    message.includes("Server selection timed out") ||
    message.includes("querySrv ECONNREFUSED") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND")
  );
}

export function formatMongoErrorForUser(error) {
  if (isMongoConnectionError(error)) {
    return "No hay conexión con MongoDB. Verifica Atlas (Network Access → tu IP), la red, o agrega POS_MASTER_PIN en .env.local para entrar sin base de datos.";
  }
  return error?.message || "Error de base de datos";
}

/** Clave master desde Mongo; si falla la conexión, usa POS_MASTER_PIN del entorno. */
export async function resolveMasterLoginCode() {
  try {
    await connectMongo();
    const scheduleConfig = await getScheduleConfig();
    return scheduleConfig.masterLoginCode || getEnvMasterPin() || "0000";
  } catch (error) {
    const envPin = getEnvMasterPin();
    if (envPin) {
      console.warn(
        "resolveMasterLoginCode: Mongo no disponible, usando POS_MASTER_PIN del entorno"
      );
      return envPin;
    }
    throw error;
  }
}

export async function tryConnectMongo() {
  try {
    await connectMongo();
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error };
  }
}
