import PosAccountant from "@/models/PosAccountant";
import PosLoginAudit from "@/models/PosLoginAudit";
import { seedPosAccountantIfEmpty } from "@/libs/posSeed";
import { getScheduleConfig } from "@/libs/posScheduleConfig";

export async function verifyAccountantPin(accountantId, pin) {
  const userId = String(accountantId || "").trim().toUpperCase();
  const loginCode = String(pin || "").trim();

  if (!userId) {
    throw new Error("Selecciona una contadora");
  }

  if (loginCode.length !== 4) {
    throw new Error("Ingresa la clave de 4 dígitos");
  }

  await seedPosAccountantIfEmpty();

  const accountant = await PosAccountant.findOne({
    accountantCode: userId,
    isActive: { $ne: false },
  });

  if (!accountant) {
    throw new Error("Contadora no encontrada");
  }

  const scheduleConfig = await getScheduleConfig();
  const masterLoginCode = scheduleConfig.masterLoginCode || "0000";
  const isMaster = loginCode === masterLoginCode;

  if (loginCode !== accountant.loginCode && !isMaster) {
    throw new Error("Clave incorrecta");
  }

  return {
    accountantId: accountant.accountantCode,
    accountantName: accountant.name,
    isMaster,
  };
}

export async function logSettlementAudit({
  action,
  accountantId,
  accountantName,
  staffId,
  staffName,
  success,
  isMaster = false,
  errorMessage = "",
  actionDetails = null,
}) {
  try {
    const created = await PosLoginAudit.create({
      role: isMaster ? "master" : "accountant",
      userId: accountantId || "",
      userName: accountantName || "",
      success,
      isMaster,
      action,
      errorMessage,
      actionDetails: actionDetails || (staffId ? { staffId, staffName } : null),
    });
    return created;
  } catch (error) {
    console.error("PosLoginAudit liquidación", error);
    return null;
  }
}
