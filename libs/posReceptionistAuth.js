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
    });
  } catch (error) {
    console.error("PosLoginAudit caja", error);
  }
}
