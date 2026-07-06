import PosReceptionist from "@/models/PosReceptionist";
import PosLoginAudit from "@/models/PosLoginAudit";
import { seedPosReceptionistsIfEmpty } from "@/libs/posSeed";
import { getScheduleConfig } from "@/libs/posScheduleConfig";

export async function verifyReceptionistPin(receptionistId, pin) {
  const userId = String(receptionistId || "").trim().toUpperCase();
  const loginCode = String(pin || "").trim();

  if (!userId) {
    throw new Error("Selecciona una recepcionista");
  }

  if (loginCode.length !== 4) {
    throw new Error("Ingresa la clave de 4 dígitos");
  }

  await seedPosReceptionistsIfEmpty();

  const receptionist = await PosReceptionist.findOne({
    receptionistCode: userId,
  });

  if (!receptionist) {
    throw new Error("Recepcionista no encontrada");
  }

  const scheduleConfig = await getScheduleConfig();
  const masterLoginCode = scheduleConfig.masterLoginCode || "0000";
  const isMaster = loginCode === masterLoginCode;

  if (loginCode !== receptionist.loginCode && !isMaster) {
    throw new Error("Clave incorrecta");
  }

  return {
    receptionistId: receptionist.receptionistCode,
    receptionistName: receptionist.name,
    isMaster,
  };
}

export async function logCashRegisterAudit({
  action,
  receptionistId,
  receptionistName,
  success,
  isMaster = false,
  cashSessionCode = "",
  errorMessage = "",
  actionDetails = null,
}) {
  try {
    await PosLoginAudit.create({
      role: isMaster ? "master" : "reception",
      userId: receptionistId || "",
      userName: receptionistName || "",
      success,
      isMaster,
      action,
      cashSessionCode,
      errorMessage,
      ...(actionDetails ? { actionDetails } : {}),
    });
  } catch (error) {
    console.error("PosLoginAudit caja", error);
  }
}

export async function logAppointmentAudit({
  action,
  receptionistId,
  receptionistName,
  success,
  isMaster = false,
  errorMessage = "",
}) {
  try {
    await PosLoginAudit.create({
      role: isMaster ? "master" : "reception",
      userId: receptionistId || "",
      userName: receptionistName || "",
      success,
      isMaster,
      action,
      errorMessage,
    });
  } catch (error) {
    console.error("PosLoginAudit appointment", error);
  }
}

export async function authorizeReceptionistAction(body, action) {
  const receptionistId = String(body?.receptionistId || "").trim();
  const pin = String(body?.pin || "").trim();

  try {
    const verified = await verifyReceptionistPin(receptionistId, pin);
    await logAppointmentAudit({
      action,
      receptionistId: verified.receptionistId,
      receptionistName: verified.receptionistName,
      success: true,
      isMaster: verified.isMaster,
    });
    return verified;
  } catch (error) {
    await logAppointmentAudit({
      action,
      receptionistId,
      success: false,
      errorMessage: error.message,
    });
    throw error;
  }
}
