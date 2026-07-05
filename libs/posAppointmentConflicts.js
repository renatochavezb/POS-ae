import PosAppointment from "@/models/PosAppointment";
import {
  parseTimeToMinutes,
  rangesOverlapMinutes,
} from "@/components/pos/scheduleUtils";

export async function findConflictingAppointment({
  date,
  staffId,
  time,
  duration,
  excludeAppointmentId,
}) {
  const start = parseTimeToMinutes(time);
  if (start < 0) return null;

  const query = {
    date,
    staffId,
    status: { $ne: "cancelled" },
  };

  if (excludeAppointmentId) {
    query.appointmentCode = { $ne: excludeAppointmentId };
  }

  const existingAppointments = await PosAppointment.find(query);

  return (
    existingAppointments.find((appointment) => {
      const appointmentStart = parseTimeToMinutes(appointment.time);
      if (appointmentStart < 0) return false;

      return rangesOverlapMinutes(
        start,
        duration,
        appointmentStart,
        appointment.duration ?? 60
      );
    }) ?? null
  );
}
