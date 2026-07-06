import PosClient from "@/models/PosClient";
import PosAppointment from "@/models/PosAppointment";
import { formatSpanishShortDateInTimeZone } from "@/components/pos/scheduleUtils";
import {
  compareSpanishShortDates,
  parseSpanishShortDateLabel,
} from "@/libs/spanishDateUtils";

export { compareSpanishShortDates, parseSpanishShortDateLabel };

export async function computeLastPaidVisitDateForClient(clientCode) {
  if (!clientCode) return "";

  const paidAppointments = await PosAppointment.find({
    clientId: clientCode,
    status: { $in: ["pagado", "completed"] },
  }).lean();

  let latestLabel = "";
  let latestTime = -1;

  for (const appointment of paidAppointments) {
    const parsed = parseSpanishShortDateLabel(appointment.date);
    if (!parsed) continue;
    const time = parsed.getTime();
    if (time > latestTime) {
      latestTime = time;
      latestLabel = appointment.date;
    }
  }

  return latestLabel;
}

export async function backfillClientsCrmFields() {
  const clients = await PosClient.find().lean();
  let updated = 0;
  const { normalizePhone, normalizeEmail, findDuplicateClient } = await import(
    "@/libs/posClientIdentity"
  );

  for (const client of clients) {
    const patch = {};
    const memberSinceDate = parseSpanishShortDateLabel(client.memberSince);
    const yearOnly = String(client.memberSince || "")
      .trim()
      .match(/^(\d{4})$/);

    if (!client.registeredAt) {
      if (memberSinceDate) {
        patch.registeredAt = memberSinceDate;
      } else if (yearOnly) {
        patch.registeredAt = new Date(Number(yearOnly[1]), 0, 1);
      } else if (client.visitsCount <= 1 && client.createdAt) {
        patch.registeredAt = new Date(client.createdAt);
      }
    }

    if (
      (!client.memberSince ||
        /^\d{4}$/.test(String(client.memberSince).trim()) ||
        !memberSinceDate) &&
      patch.registeredAt
    ) {
      patch.memberSince = formatSpanishShortDateInTimeZone(patch.registeredAt);
    }

    if (!client.lastPaidVisitDate) {
      const computed = await computeLastPaidVisitDateForClient(client.clientCode);
      if (computed) {
        patch.lastPaidVisitDate = computed;
      }
    }

    const phoneNormalized = normalizePhone(client.phone);
    if (phoneNormalized.length >= 10 && client.phoneNormalized !== phoneNormalized) {
      const duplicate = await findDuplicateClient({
        phone: client.phone,
        excludeClientCode: client.clientCode,
      });
      if (!duplicate) {
        patch.phoneNormalized = phoneNormalized;
      }
    }

    const emailNormalized = normalizeEmail(client.email);
    if (emailNormalized && client.emailNormalized !== emailNormalized) {
      const duplicate = await findDuplicateClient({
        email: client.email,
        excludeClientCode: client.clientCode,
      });
      if (!duplicate) {
        patch.emailNormalized = emailNormalized;
      }
    }

    if (Object.keys(patch).length > 0) {
      try {
        await PosClient.updateOne({ clientCode: client.clientCode }, { $set: patch });
        updated += 1;
      } catch (error) {
        if (error?.code === 11000) {
          console.warn(
            `backfillClientsCrmFields: omitido ${client.clientCode} por duplicado de índice`
          );
          continue;
        }
        throw error;
      }
    }
  }

  await fixIncorrectRecentRegisteredAt();

  return updated;
}

async function fixIncorrectRecentRegisteredAt() {
  const threeWeeksMs = 21 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const suspicious = await PosClient.find({
    visitsCount: { $gt: 1 },
    registeredAt: { $exists: true, $ne: null },
  }).lean();

  for (const client of suspicious) {
    const registeredAt = new Date(client.registeredAt);
    if (Number.isNaN(registeredAt.getTime())) continue;
    if (now - registeredAt.getTime() > threeWeeksMs) continue;

    const memberSinceDate = parseSpanishShortDateLabel(client.memberSince);
    const yearOnly = String(client.memberSince || "")
      .trim()
      .match(/^(\d{4})$/);

    let corrected = null;
    if (memberSinceDate) corrected = memberSinceDate;
    else if (yearOnly) corrected = new Date(Number(yearOnly[1]), 0, 1);

    if (corrected) {
      await PosClient.updateOne(
        { clientCode: client.clientCode },
        { $set: { registeredAt: corrected } }
      );
    }
  }
}
