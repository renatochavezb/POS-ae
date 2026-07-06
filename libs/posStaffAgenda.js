import { formatSpanishShortDateInTimeZone } from "@/components/pos/scheduleUtils";
import { compareSpanishShortDates } from "@/libs/spanishDateUtils";

export function isStaffActiveForOperations(staff) {
  return staff?.isActive !== false;
}

function resolveLastVisibleAgendaDay(staff) {
  if (staff?.deactivatedAgendaDate) {
    return staff.deactivatedAgendaDate;
  }

  if (staff?.deactivatedAt) {
    return formatSpanishShortDateInTimeZone(new Date(staff.deactivatedAt));
  }

  return "";
}

/**
 * Manicurista activa: siempre en agenda.
 * Dada de baja el día D: visible en D y en todos los días anteriores;
 * oculta desde el día siguiente a D en adelante.
 */
export function shouldShowStaffOnAgendaDay(staff, selectedDayLabel) {
  if (isStaffActiveForOperations(staff)) return true;

  const lastVisibleDay = resolveLastVisibleAgendaDay(staff);
  if (!lastVisibleDay || !selectedDayLabel) return false;

  return compareSpanishShortDates(selectedDayLabel, lastVisibleDay) <= 0;
}

export function getAgendaStaffForDate(staffList, selectedDayLabel) {
  return staffList.filter((staff) =>
    shouldShowStaffOnAgendaDay(staff, selectedDayLabel)
  );
}

export function getBookableStaff(staffList) {
  return staffList.filter(isStaffActiveForOperations);
}
