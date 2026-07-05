import PosScheduleConfig from "@/models/PosScheduleConfig";
import {
  BOOKING_DURATION_OPTIONS,
  POS_TIME_ZONE,
  SCHEDULE_END_HOUR,
  SCHEDULE_START_HOUR,
} from "@/components/pos/scheduleUtils";

export const DEFAULT_SCHEDULE_CONFIG = {
  startHour: SCHEDULE_START_HOUR,
  endHour: SCHEDULE_END_HOUR,
  slotIntervalMinutes: 30,
  bookingDurationOptions: BOOKING_DURATION_OPTIONS,
  closeDurationOptions: BOOKING_DURATION_OPTIONS,
  closeReasons: ["Descanso", "Comida", "Capacitación", "Personal", "Otro"],
  timeZone: POS_TIME_ZONE,
  masterLoginCode: "0000",
};

export function mapScheduleConfigDoc(doc) {
  const raw = doc?.toObject ? doc.toObject() : doc || {};

  return {
    startHour: raw.startHour ?? DEFAULT_SCHEDULE_CONFIG.startHour,
    endHour: raw.endHour ?? DEFAULT_SCHEDULE_CONFIG.endHour,
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
  const doc = await PosScheduleConfig.findOne({ configCode: "default" });
  return mapScheduleConfigDoc(doc);
}
