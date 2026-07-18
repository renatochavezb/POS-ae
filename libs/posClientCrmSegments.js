import PosClient from "@/models/PosClient";
import PosAppointment from "@/models/PosAppointment";
import { getMexicoDateYMD } from "@/components/pos/scheduleUtils";
import {
  isAppointmentCancelled,
  isAppointmentUnconfirmed,
  isAppointmentPendingPayment,
  normalizeAppointmentStatus,
} from "@/components/pos/appointmentStatus";

export const CRM_WEEKS_DAYS = 21;
export const INACTIVE_DAYS = 45;
export const UPCOMING_WINDOW_DAYS = 7;

export const CRM_SEGMENT_KEYS = [
  "inactive",
  "upcoming",
  "unconfirmed",
  "nuevas",
  "birthday",
  "alerts",
  "reschedule",
];

const MONTH_NAME_TO_INDEX = {
  ene: 0,
  enero: 0,
  jan: 0,
  feb: 1,
  febrero: 1,
  mar: 2,
  marzo: 2,
  abr: 3,
  abril: 3,
  apr: 3,
  may: 4,
  mayo: 4,
  jun: 5,
  junio: 5,
  jul: 6,
  julio: 6,
  ago: 7,
  agosto: 7,
  aug: 7,
  sep: 8,
  sept: 8,
  septiembre: 8,
  oct: 9,
  octubre: 9,
  nov: 10,
  noviembre: 10,
  dic: 11,
  diciembre: 11,
  dec: 11,
};

const ALERT_PLACEHOLDER =
  /^(n\/a|na|ninguna|none|no|sin alertas|sin contraindicaciones|no especificado|new client|nueva|por definir)$/i;

export function parseSpanishShortDateLabel(label) {
  const trimmed = String(label || "").trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})\s+([A-Za-záéíóúÁÉÍÓÚ]{3,9}),?\s*(\d{4})?$/i);
  if (!match) return null;

  const day = Number(match[1]);
  const monthKey = match[2]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const month =
    MONTH_NAME_TO_INDEX[monthKey.slice(0, 3)] ?? MONTH_NAME_TO_INDEX[monthKey];
  const year = match[3] ? Number(match[3]) : null;

  if (month == null || Number.isNaN(day) || year == null || Number.isNaN(year)) {
    return null;
  }

  return new Date(year, month, day);
}

export function parseBirthdayMonth(birthday) {
  const trimmed = String(birthday || "").trim();
  if (!trimmed || trimmed.toLowerCase().includes("no especificado")) return null;

  const slashMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})/);
  if (slashMatch) {
    const month = Number(slashMatch[2]) - 1;
    return month >= 0 && month <= 11 ? month : null;
  }

  const textMatch = trimmed.match(/(\d{1,2})\s+([A-Za-záéíóúÁÉÍÓÚ]{3,9})/i);
  if (textMatch) {
    const monthKey = textMatch[2]
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const month =
      MONTH_NAME_TO_INDEX[monthKey.slice(0, 3)] ?? MONTH_NAME_TO_INDEX[monthKey];
    return month ?? null;
  }

  return null;
}

export function getMeaningfulAlerts(alerts = []) {
  return alerts
    .map((alert) => String(alert).trim())
    .filter((alert) => alert.length >= 3 && !ALERT_PLACEHOLDER.test(alert));
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(earlier, later) {
  const ms = startOfLocalDay(later).getTime() - startOfLocalDay(earlier).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function getMexicoTodayDate() {
  const ymd = getMexicoDateYMD();
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function mapAppointmentRow(doc) {
  const raw = doc?.toObject ? doc.toObject() : doc;
  return {
    id: raw.appointmentCode,
    date: raw.date,
    time: raw.time,
    status: raw.status,
    clientId: raw.clientId,
  };
}

function mapClientRow(doc) {
  const raw = doc?.toObject ? doc.toObject() : doc;
  return {
    id: raw.clientCode,
    memberSince: raw.memberSince || "",
    registeredAt: raw.registeredAt ? new Date(raw.registeredAt).toISOString() : "",
    lastPaidVisitDate: raw.lastPaidVisitDate || "",
    birthday: raw.birthday || "",
    alerts: raw.alerts || [],
    visitsCount: raw.visitsCount ?? 0,
  };
}

function isPendingFutureAppointment(appointment, today) {
  if (isAppointmentCancelled(appointment.status)) return false;
  if (!isAppointmentPendingPayment(appointment.status)) return false;

  const appointmentDate = parseSpanishShortDateLabel(appointment.date);
  if (!appointmentDate) return false;

  return startOfLocalDay(appointmentDate).getTime() >= startOfLocalDay(today).getTime();
}

function resolveRegisteredDate(client) {
  const memberSinceDate = parseSpanishShortDateLabel(client.memberSince);
  if (memberSinceDate) return memberSinceDate;

  const yearOnly = String(client.memberSince || "")
    .trim()
    .match(/^(\d{4})$/);
  if (yearOnly) return new Date(Number(yearOnly[1]), 0, 1);

  if (client.registeredAt) {
    const parsed = new Date(client.registeredAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function resolveLastPaidVisitDate(client, clientAppointments, today) {
  let latest = null;

  if (client.lastPaidVisitDate) {
    const stored = parseSpanishShortDateLabel(client.lastPaidVisitDate);
    if (stored) latest = stored;
  }

  for (const appointment of clientAppointments) {
    if (normalizeAppointmentStatus(appointment.status) !== "terminado") continue;
    const appointmentDate = parseSpanishShortDateLabel(appointment.date);
    if (!appointmentDate) continue;
    if (startOfLocalDay(appointmentDate).getTime() > startOfLocalDay(today).getTime()) {
      continue;
    }
    if (!latest || appointmentDate.getTime() > latest.getTime()) {
      latest = appointmentDate;
    }
  }

  return latest;
}

function pickNextPendingAppointment(appointments, today) {
  const pending = appointments
    .filter((appointment) => isPendingFutureAppointment(appointment, today))
    .map((appointment) => ({
      appointment,
      date: parseSpanishShortDateLabel(appointment.date),
    }))
    .filter((entry) => entry.date)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return pending[0]?.appointment ?? null;
}

export function computeClientCrmSegments(clientDoc, appointmentDocs = []) {
  const client = mapClientRow(clientDoc);
  const appointments = appointmentDocs.map(mapAppointmentRow);
  const today = getMexicoTodayDate();
  const weekEnd = addDays(today, UPCOMING_WINDOW_DAYS);
  const pendingFutureAppointments = appointments.filter((appointment) =>
    isPendingFutureAppointment(appointment, today)
  );
  const registeredDate = resolveRegisteredDate(client);
  const lastPaidVisit = resolveLastPaidVisitDate(client, appointments, today);
  const birthdayMonth = parseBirthdayMonth(client.birthday);
  const meaningfulAlerts = getMeaningfulAlerts(client.alerts);
  const nextPendingAppointment = pickNextPendingAppointment(appointments, today);

  const hasUpcomingThisWeek = pendingFutureAppointments.some((appointment) => {
    const appointmentDate = parseSpanishShortDateLabel(appointment.date);
    if (!appointmentDate) return false;
    return (
      startOfLocalDay(appointmentDate).getTime() >= startOfLocalDay(today).getTime() &&
      startOfLocalDay(appointmentDate).getTime() <= startOfLocalDay(weekEnd).getTime()
    );
  });

  const hasUnconfirmedFuture = pendingFutureAppointments.some((appointment) =>
    isAppointmentUnconfirmed(appointment.status)
  );

  const hasCancelled = appointments.some((appointment) =>
    isAppointmentCancelled(appointment.status)
  );

  const daysSinceRegistered = registeredDate ? daysBetween(registeredDate, today) : null;
  const daysSinceLastPaid = lastPaidVisit ? daysBetween(lastPaidVisit, today) : null;

  const isInactive =
    pendingFutureAppointments.length === 0 &&
    ((daysSinceLastPaid != null && daysSinceLastPaid >= INACTIVE_DAYS) ||
      (daysSinceLastPaid == null &&
        daysSinceRegistered != null &&
        daysSinceRegistered >= INACTIVE_DAYS));

  const isNew =
    daysSinceRegistered != null &&
    daysSinceRegistered <= CRM_WEEKS_DAYS &&
    client.visitsCount <= 1;

  const hasBirthdayThisMonth =
    birthdayMonth != null && birthdayMonth === today.getMonth();

  const hasAlerts = meaningfulAlerts.length > 0;

  const needsReschedule =
    pendingFutureAppointments.length === 0 &&
    (hasCancelled ||
      (daysSinceLastPaid != null && daysSinceLastPaid <= CRM_WEEKS_DAYS));

  const flags = {
    inactive: isInactive,
    upcoming: hasUpcomingThisWeek,
    unconfirmed: hasUnconfirmedFuture,
    nuevas: isNew,
    birthday: hasBirthdayThisMonth,
    alerts: hasAlerts,
    reschedule: needsReschedule,
  };

  const details = {};

  if (isInactive) {
    details.inactive =
      daysSinceLastPaid != null
        ? `Sin visita pagada en ${daysSinceLastPaid} días`
        : "Sin visitas pagadas registradas";
  }

  if (hasUpcomingThisWeek && nextPendingAppointment) {
    details.upcoming = `${nextPendingAppointment.date} · ${nextPendingAppointment.time}`;
  }

  if (hasUnconfirmedFuture) {
    const unconfirmed = pendingFutureAppointments.find((appointment) =>
      isAppointmentUnconfirmed(appointment.status)
    );
    if (unconfirmed) {
      details.unconfirmed = `${unconfirmed.date} · ${unconfirmed.time}`;
    }
  }

  if (isNew && registeredDate) {
    details.nuevas = `Registrada hace ${daysSinceRegistered ?? 0} días`;
  }

  if (hasBirthdayThisMonth) {
    details.birthday = client.birthday;
  }

  if (hasAlerts) {
    details.alerts = meaningfulAlerts[0];
  }

  if (needsReschedule) {
    details.reschedule =
      daysSinceLastPaid != null && daysSinceLastPaid <= CRM_WEEKS_DAYS
        ? `Pagó hace ${daysSinceLastPaid} días · sin cita pendiente`
        : "Canceló y no tiene otra cita pendiente";
  }

  return {
    flags,
    details,
    syncedAt: new Date(),
  };
}

export async function syncClientCrmSegments(clientCode) {
  if (!clientCode) return null;

  const client = await PosClient.findOne({ clientCode });
  if (!client) return null;

  const appointments = await PosAppointment.find({ clientId: clientCode }).lean();
  const computed = computeClientCrmSegments(client, appointments);

  await PosClient.updateOne(
    { clientCode },
    {
      $set: {
        crmSegmentFlags: computed.flags,
        crmSegmentDetails: computed.details,
        crmSegmentsSyncedAt: computed.syncedAt,
      },
    }
  );

  return computed;
}

export async function syncAllClientCrmSegments() {
  const clients = await PosClient.find({}, { clientCode: 1 }).lean();
  let updated = 0;

  for (const client of clients) {
    await syncClientCrmSegments(client.clientCode);
    updated += 1;
  }

  return updated;
}

export async function syncClientCrmSegmentsForClients(clientCodes = []) {
  const uniqueCodes = [...new Set(clientCodes.filter(Boolean))];
  for (const clientCode of uniqueCodes) {
    await syncClientCrmSegments(clientCode);
  }
}
