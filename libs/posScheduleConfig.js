import PosScheduleConfig from "@/models/PosScheduleConfig";
import {
  BOOKING_DURATION_OPTIONS,
  POS_TIME_ZONE,
  SCHEDULE_END_HOUR,
  SCHEDULE_START_HOUR,
} from "@/components/pos/scheduleUtils";

export const DEFAULT_WEEKLY_HOURS = {
  weekday: { startHour: 9, endHour: 21, closed: false },
  saturday: { startHour: 9, endHour: 18, closed: false },
  sundayHoliday: { startHour: 9, endHour: 21, closed: true },
};

export const DEFAULT_CABIN_CAPACITY = 12;

export const DEFAULT_SCHEDULE_CONFIG = {
  startHour: SCHEDULE_START_HOUR,
  endHour: SCHEDULE_END_HOUR,
  slotIntervalMinutes: 30,
  bookingDurationOptions: BOOKING_DURATION_OPTIONS,
  closeDurationOptions: BOOKING_DURATION_OPTIONS,
  closeReasons: ["Descanso", "Comida", "Capacitación", "Personal", "Otro"],
  timeZone: POS_TIME_ZONE,
  masterLoginCode: "0000",
  cabinCapacity: DEFAULT_CABIN_CAPACITY,
  weeklyHours: DEFAULT_WEEKLY_HOURS,
};

function normalizeCabinCapacity(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_CABIN_CAPACITY;
  return Math.min(100, Math.max(1, Math.round(value)));
}

function normalizeWeeklyHoursSlot(raw, fallback) {
  return {
    startHour: raw?.startHour ?? fallback.startHour,
    endHour: raw?.endHour ?? fallback.endHour,
    closed: Boolean(raw?.closed ?? fallback.closed),
  };
}

export function normalizeWeeklyHours(raw) {
  return {
    weekday: normalizeWeeklyHoursSlot(raw?.weekday, DEFAULT_WEEKLY_HOURS.weekday),
    saturday: normalizeWeeklyHoursSlot(raw?.saturday, DEFAULT_WEEKLY_HOURS.saturday),
    sundayHoliday: normalizeWeeklyHoursSlot(
      raw?.sundayHoliday,
      DEFAULT_WEEKLY_HOURS.sundayHoliday
    ),
  };
}

export function mapScheduleConfigDoc(doc) {
  const raw = doc?.toObject ? doc.toObject() : doc || {};
  const weeklyHours = normalizeWeeklyHours(raw.weeklyHours);

  return {
    startHour: raw.startHour ?? weeklyHours.weekday.startHour ?? DEFAULT_SCHEDULE_CONFIG.startHour,
    endHour: raw.endHour ?? weeklyHours.weekday.endHour ?? DEFAULT_SCHEDULE_CONFIG.endHour,
    slotIntervalMinutes:
      raw.slotIntervalMinutes ?? DEFAULT_SCHEDULE_CONFIG.slotIntervalMinutes,
    bookingDurationOptions:
      raw.bookingDurationOptions?.length > 0
        ? raw.bookingDurationOptions
        : DEFAULT_SCHEDULE_CONFIG.bookingDurationOptions,
    closeDurationOptions:
      raw.closeDurationOptions?.length > 0
        ? raw.closeDurationOptions
        : DEFAULT_SCHEDULE_CONFIG.closeDurationOptions,
    closeReasons:
      raw.closeReasons?.length > 0
        ? raw.closeReasons
        : DEFAULT_SCHEDULE_CONFIG.closeReasons,
    timeZone: raw.timeZone || DEFAULT_SCHEDULE_CONFIG.timeZone,
    masterLoginCode:
      raw.masterLoginCode || DEFAULT_SCHEDULE_CONFIG.masterLoginCode,
    cabinCapacity: normalizeCabinCapacity(raw.cabinCapacity),
    weeklyHours,
  };
}

export async function seedScheduleConfigIfEmpty() {
  const count = await PosScheduleConfig.countDocuments();
  if (count > 0) return false;

  await PosScheduleConfig.create({
    configCode: "default",
    ...DEFAULT_SCHEDULE_CONFIG,
  });

  return true;
}

export async function getScheduleConfig() {
  await seedScheduleConfigIfEmpty();
  let doc = await PosScheduleConfig.findOne({ configCode: "default" });

  // Migración suave: docs antiguos sin cabinCapacity.
  if (doc && (doc.cabinCapacity == null || !Number.isFinite(Number(doc.cabinCapacity)))) {
    doc = await PosScheduleConfig.findOneAndUpdate(
      { configCode: "default" },
      { $set: { cabinCapacity: DEFAULT_CABIN_CAPACITY } },
      { new: true }
    );
  }

  return mapScheduleConfigDoc(doc);
}

function validateWeeklyHoursSlot(slot, label) {
  if (slot.closed) return null;

  const startHour = Number(slot.startHour);
  const endHour = Number(slot.endHour);

  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) {
    return `${label}: horario inválido`;
  }

  if (startHour < 0 || startHour > 23 || endHour < 1 || endHour > 24) {
    return `${label}: usa horas entre 0 y 24`;
  }

  if (startHour >= endHour) {
    return `${label}: la hora de cierre debe ser posterior a la de apertura`;
  }

  return null;
}

export function validateWeeklyHours(weeklyHours) {
  const normalized = normalizeWeeklyHours(weeklyHours);

  for (const [key, label] of [
    ["weekday", "Lunes a Viernes"],
    ["saturday", "Sábados"],
    ["sundayHoliday", "Domingos y Festivos"],
  ]) {
    const error = validateWeeklyHoursSlot(normalized[key], label);
    if (error) return error;
  }

  return null;
}

export async function updateScheduleConfig({ pin, weeklyHours, cabinCapacity }) {
  const validationError = validateWeeklyHours(weeklyHours);
  if (validationError) {
    throw new Error(validationError);
  }

  await seedScheduleConfigIfEmpty();
  const doc = await PosScheduleConfig.findOne({ configCode: "default" });
  const current = mapScheduleConfigDoc(doc);
  const masterLoginCode = current.masterLoginCode || "0000";

  if (String(pin || "").trim() !== masterLoginCode) {
    throw new Error("Clave de administrador incorrecta");
  }

  const normalizedWeeklyHours = normalizeWeeklyHours(weeklyHours);
  const nextCabinCapacity =
    cabinCapacity == null
      ? current.cabinCapacity
      : normalizeCabinCapacity(cabinCapacity);

  const updated = await PosScheduleConfig.findOneAndUpdate(
    { configCode: "default" },
    {
      $set: {
        weeklyHours: normalizedWeeklyHours,
        startHour: normalizedWeeklyHours.weekday.startHour,
        endHour: normalizedWeeklyHours.weekday.endHour,
        cabinCapacity: nextCabinCapacity,
      },
    },
    { new: true }
  );

  return mapScheduleConfigDoc(updated);
}
