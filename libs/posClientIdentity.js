import PosClient from "@/models/PosClient";

export function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function generateNextClientCode() {
  const clients = await PosClient.find({}, { clientCode: 1 }).lean();
  let maxSequence = 1000;

  for (const client of clients) {
    const match = String(client.clientCode || "").match(/^SA-(\d+)$/i);
    if (match) {
      maxSequence = Math.max(maxSequence, Number(match[1]));
    }
  }

  return `SA-${maxSequence + 1}`;
}

export async function findDuplicateClient({ phone, email, excludeClientCode = "" }) {
  const phoneNormalized = normalizePhone(phone);
  const emailNormalized = normalizeEmail(email);
  const exclude = excludeClientCode
    ? { clientCode: { $ne: excludeClientCode } }
    : {};

  if (phoneNormalized.length >= 10) {
    const byPhone = await PosClient.findOne({ phoneNormalized, ...exclude });
    if (byPhone) {
      return { reason: "phone", client: byPhone };
    }
  }

  if (emailNormalized) {
    const byEmail = await PosClient.findOne({ emailNormalized, ...exclude });
    if (byEmail) {
      return { reason: "email", client: byEmail };
    }
  }

  return null;
}

export function duplicateClientMessage(duplicate) {
  if (!duplicate?.client) return "Ya existe una clienta con esos datos.";

  const { client, reason } = duplicate;
  const id = client.clientCode;
  const name = client.name;

  if (reason === "phone") {
    return `Ya existe una clienta con ese teléfono: ${name} (${id}).`;
  }

  if (reason === "email") {
    return `Ya existe una clienta con ese correo: ${name} (${id}).`;
  }

  return `Ya existe una clienta registrada: ${name} (${id}).`;
}
