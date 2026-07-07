import { parseSpanishShortDateLabel } from '@/libs/spanishDateUtils';

export const SCHEDULE_START_HOUR = 9;
export const SCHEDULE_END_HOUR = 21;

/** Zona horaria operativa del salón (Ciudad de México). */
export const POS_TIME_ZONE = 'America/Mexico_City';

const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const EN_MONTH_TO_SHORT: Record<string, string> = {
  Jan: 'Ene',
  Feb: 'Feb',
  Mar: 'Mar',
  Apr: 'Abr',
  May: 'May',
  Jun: 'Jun',
  Jul: 'Jul',
  Aug: 'Ago',
  Sep: 'Sep',
  Oct: 'Oct',
  Nov: 'Nov',
  Dec: 'Dic',
};

/** Formato usado en citas y calendario: "1 Jul, 2026" (zona horaria del salón). */
export const formatSpanishShortDateInTimeZone = (
  date: Date,
  timeZone: string = POS_TIME_ZONE
): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(date);

  const day = parts.find((part) => part.type === 'day')?.value ?? '1';
  const monthEn = parts.find((part) => part.type === 'month')?.value ?? 'Jan';
  const year = parts.find((part) => part.type === 'year')?.value ?? '2026';

  return `${day} ${EN_MONTH_TO_SHORT[monthEn] ?? monthEn}, ${year}`;
};

/** Formato local del navegador (p. ej. celdas del calendario). */
export const formatSpanishShortDate = (date: Date): string =>
  `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}, ${date.getFullYear()}`;

/** Fecha operativa de hoy en el salón — usar para conteos y bookedOnDate. */
export const getTodaySpanishShortDate = (): string =>
  formatSpanishShortDateInTimeZone(new Date());

/** Fecha YYYY-MM-DD en zona horaria del salón (para consultas MongoDB). */
export const getMexicoDateYMD = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: POS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

/** Convierte YYYY-MM-DD a Date local (medianoche). */
export const dateFromMexicoYmd = (ymd: string): Date => {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** Etiqueta corta en español a partir de YYYY-MM-DD. */
export const formatSpanishShortDateFromYmd = (ymd: string): string =>
  formatSpanishShortDateInTimeZone(dateFromMexicoYmd(ymd));

/** Lunes de la semana que contiene la fecha dada. */
export const getMonday = (date: Date): Date => {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = normalized.getDay();
  const diff = normalized.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(normalized.setDate(diff));
};

export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
};

export const WEEK_DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

export type WeekDayEntry = {
  dayLabel: string;
  dateLabel: string;
  date: Date;
};

/** Lunes a domingo de la semana que empieza en weekStartMonday. */
export function buildWeekDayEntries(weekStartMonday: Date): WeekDayEntry[] {
  return WEEK_DAY_LABELS.map((dayLabel, index) => {
    const date = addDays(weekStartMonday, index);
    return {
      dayLabel,
      dateLabel: formatSpanishShortDateInTimeZone(date),
      date,
    };
  });
}

/** Rango legible: "29 Jun – 5 Jul, 2026" */
export function formatWeekRangeLabel(weekStartMonday: Date): string {
  const weekEnd = addDays(weekStartMonday, 6);
  const startLabel = formatSpanishShortDateInTimeZone(weekStartMonday);
  const endLabel = formatSpanishShortDateInTimeZone(weekEnd);

  const startMatch = startLabel.match(/^(\d{1,2})\s+([A-Za-záéíóú]+)/i);
  const endMatch = endLabel.match(/^(\d{1,2})\s+([A-Za-záéíóú]+),?\s*(\d{4})/i);

  if (!startMatch || !endMatch) {
    return `${startLabel} – ${endLabel}`;
  }

  return `${startMatch[1]} ${startMatch[2]} – ${endMatch[1]} ${endMatch[2]}, ${endMatch[3]}`;
}

export function isCurrentWeek(weekStartMonday: Date): boolean {
  return getMonday(new Date()).getTime() === weekStartMonday.getTime();
}

/** Hourly rows shown in the agenda grid (9:00 – 21:00). */
export const CALENDAR_HOUR_SLOTS = Array.from(
  { length: SCHEDULE_END_HOUR - SCHEDULE_START_HOUR + 1 },
  (_, i) => `${String(SCHEDULE_START_HOUR + i).padStart(2, '0')}:00`
);

/** Bookable times every 30 minutes within business hours. */
export const BOOKING_TIME_OPTIONS = (() => {
  const options: string[] = [];
  for (let hour = SCHEDULE_START_HOUR; hour <= SCHEDULE_END_HOUR; hour++) {
    options.push(`${String(hour).padStart(2, '0')}:00`);
    if (hour < SCHEDULE_END_HOUR) {
      options.push(`${String(hour).padStart(2, '0')}:30`);
    }
  }
  return options;
})();

/** Duraciones habituales para reservar (minutos). */
export const BOOKING_DURATION_OPTIONS = [30, 45, 60, 75, 90, 120, 150, 180, 210, 240];

export interface ScheduleConfig {
  startHour: number;
  endHour: number;
  slotIntervalMinutes: number;
  bookingDurationOptions: number[];
  closeDurationOptions: number[];
  closeReasons: string[];
  timeZone: string;
  masterLoginCode?: string;
  weeklyHours?: {
    weekday: { startHour: number; endHour: number; closed: boolean };
    saturday: { startHour: number; endHour: number; closed: boolean };
    sundayHoliday: { startHour: number; endHour: number; closed: boolean };
  };
}

export const DEFAULT_WEEKLY_HOURS = {
  weekday: { startHour: 9, endHour: 21, closed: false },
  saturday: { startHour: 9, endHour: 18, closed: false },
  sundayHoliday: { startHour: 9, endHour: 21, closed: true },
};

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  startHour: SCHEDULE_START_HOUR,
  endHour: SCHEDULE_END_HOUR,
  slotIntervalMinutes: 30,
  bookingDurationOptions: BOOKING_DURATION_OPTIONS,
  closeDurationOptions: BOOKING_DURATION_OPTIONS,
  closeReasons: ['Descanso', 'Comida', 'Capacitación', 'Personal', 'Otro'],
  timeZone: POS_TIME_ZONE,
  weeklyHours: DEFAULT_WEEKLY_HOURS,
};

export type WeeklyHoursKey = 'weekday' | 'saturday' | 'sundayHoliday';

export type ResolvedDaySchedule = {
  key: WeeklyHoursKey;
  startHour: number;
  endHour: number;
  closed: boolean;
  hoursLabel: string;
};

export function resolveWeeklyHoursKey(date: Date): WeeklyHoursKey {
  const day = date.getDay();
  if (day === 0) return 'sundayHoliday';
  if (day === 6) return 'saturday';
  return 'weekday';
}

export function resolveScheduleForDate(
  date: Date,
  config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG
): ResolvedDaySchedule {
  const weeklyHours = config.weeklyHours || DEFAULT_WEEKLY_HOURS;
  const key = resolveWeeklyHoursKey(date);
  const slot = weeklyHours[key];

  return {
    key,
    startHour: slot.startHour,
    endHour: slot.endHour,
    closed: slot.closed,
    hoursLabel: slot.closed
      ? 'Cerrado'
      : `${String(slot.startHour).padStart(2, '0')}:00 – ${String(slot.endHour).padStart(2, '0')}:00`,
  };
}

export function resolveScheduleForDateLabel(
  dateLabel: string,
  config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG
): ResolvedDaySchedule {
  const parsed = parseSpanishShortDateLabel(dateLabel);
  if (!parsed) {
    return resolveScheduleForDate(new Date(), config);
  }
  return resolveScheduleForDate(parsed, config);
}

export function buildDayScheduleConfig(
  date: Date,
  config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG
): ScheduleConfig {
  const resolved = resolveScheduleForDate(date, config);

  if (resolved.closed) {
    return {
      ...config,
      startHour: DEFAULT_WEEKLY_HOURS.weekday.startHour,
      endHour: DEFAULT_WEEKLY_HOURS.weekday.endHour,
    };
  }

  return {
    ...config,
    startHour: resolved.startHour,
    endHour: resolved.endHour,
  };
}

export function buildDayScheduleConfigForLabel(
  dateLabel: string,
  config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG
): ScheduleConfig {
  const parsed = parseSpanishShortDateLabel(dateLabel);
  if (!parsed) return config;
  return buildDayScheduleConfig(parsed, config);
}

export function isTimeWithinDaySchedule(
  time: string,
  date: Date,
  config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG
): boolean {
  const resolved = resolveScheduleForDate(date, config);
  if (resolved.closed) return false;

  const minutes = parseTimeToMinutes(time);
  if (minutes < 0) return false;

  return minutes >= resolved.startHour * 60 && minutes < resolved.endHour * 60;
}

export const buildCalendarHourSlots = (
  config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG
): string[] =>
  Array.from(
    { length: config.endHour - config.startHour + 1 },
    (_, i) => `${String(config.startHour + i).padStart(2, '0')}:00`
  );

export const buildBookingTimeOptions = (
  config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG
): string[] => {
  const options: string[] = [];

  for (let hour = config.startHour; hour <= config.endHour; hour++) {
    options.push(`${String(hour).padStart(2, '0')}:00`);
    if (hour < config.endHour) {
      options.push(`${String(hour).padStart(2, '0')}:30`);
    }
  }

  return options;
};

export const getDurationOptionsFromConfig = (
  config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG,
  serviceDuration?: number
): number[] => {
  const options = config.bookingDurationOptions;

  if (serviceDuration && !options.includes(serviceDuration)) {
    return [...options, serviceDuration].sort((a, b) => a - b);
  }

  return options;
};

export const getCloseDurationOptionsFromConfig = (
  config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG
): number[] => config.closeDurationOptions;

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
};

export const formatMinutesAsTime = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const formatAppointmentTimeRange = (time: string, durationMinutes: number): string => {
  const startMinutes = parseTimeToMinutes(time);
  if (startMinutes < 0) return time;
  const endMinutes = startMinutes + durationMinutes;
  return `${time} – ${formatMinutesAsTime(endMinutes)}`;
};

export const appointmentStartsInHourSlot = (
  appointmentTime: string,
  hourSlot: string
): boolean => {
  const appointmentMinutes = parseTimeToMinutes(appointmentTime);
  const slotStart = getHourSlotStartMinutes(hourSlot);

  if (appointmentMinutes < 0) return false;

  return appointmentMinutes >= slotStart && appointmentMinutes < slotStart + 60;
};

export const appointmentOverlapsHourSlot = (
  appointmentTime: string,
  durationMinutes: number,
  hourSlot: string
): boolean => {
  const startMinutes = parseTimeToMinutes(appointmentTime);
  if (startMinutes < 0) return false;

  const endMinutes = startMinutes + durationMinutes;
  const slotStart = getHourSlotStartMinutes(hourSlot);
  const slotEnd = slotStart + 60;

  return startMinutes < slotEnd && endMinutes > slotStart;
};

export const parseTimeToMinutes = (timeStr: string): number => {
  const cleaned = timeStr.trim().toUpperCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return -1;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3];

  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

export const getHourSlotStartMinutes = (hourSlot: string): number => {
  const [hours, minutes] = hourSlot.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

export const getDurationOptions = (serviceDuration?: number): number[] => {
  if (serviceDuration && !BOOKING_DURATION_OPTIONS.includes(serviceDuration)) {
    return [...BOOKING_DURATION_OPTIONS, serviceDuration].sort((a, b) => a - b);
  }
  return BOOKING_DURATION_OPTIONS;
};

export const rangesOverlapMinutes = (
  startA: number,
  durationA: number,
  startB: number,
  durationB: number
) => startA < startB + durationB && startA + durationA > startB;

type AppointmentSlot = {
  id?: string;
  date: string;
  staffId: string;
  time: string;
  duration: number;
  status?: string;
  clientName?: string;
};

/** Detecta si una cita nueva se empalma con otra del mismo especialista y día. */
export const appointmentConflictsWithExisting = (
  appointments: AppointmentSlot[],
  date: string,
  staffId: string,
  time: string,
  duration: number,
  excludeAppointmentId?: string
): boolean => {
  const start = parseTimeToMinutes(time);
  if (start < 0) return false;

  return appointments.some((appointment) => {
    if (appointment.status === 'cancelled') return false;
    if (excludeAppointmentId && appointment.id === excludeAppointmentId) return false;
    if (appointment.date !== date || appointment.staffId !== staffId) return false;

    const appointmentStart = parseTimeToMinutes(appointment.time);
    if (appointmentStart < 0) return false;

    return rangesOverlapMinutes(start, duration, appointmentStart, appointment.duration);
  });
};

export const getConflictingAppointment = (
  appointments: AppointmentSlot[],
  date: string,
  staffId: string,
  time: string,
  duration: number,
  excludeAppointmentId?: string
): AppointmentSlot | undefined =>
  appointments.find((appointment) => {
    if (appointment.status === 'cancelled') return false;
    if (excludeAppointmentId && appointment.id === excludeAppointmentId) return false;
    if (appointment.date !== date || appointment.staffId !== staffId) return false;

    const start = parseTimeToMinutes(time);
    const appointmentStart = parseTimeToMinutes(appointment.time);
    if (start < 0 || appointmentStart < 0) return false;

    return rangesOverlapMinutes(start, duration, appointmentStart, appointment.duration);
  });

export const isStaffTimeBlocked = (
  blockedSlots: { date: string; staffId: string; time: string; duration: number }[],
  date: string,
  staffId: string,
  time: string,
  duration = 30
): boolean => {
  const start = parseTimeToMinutes(time);
  if (start < 0) return false;

  return blockedSlots.some((slot) => {
    if (slot.date !== date || slot.staffId !== staffId) return false;
    const blockedStart = parseTimeToMinutes(slot.time);
    if (blockedStart < 0) return false;
    return rangesOverlapMinutes(start, duration, blockedStart, slot.duration);
  });
};
