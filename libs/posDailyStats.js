import PosAppointment from "@/models/PosAppointment";
import PosDailySnapshot from "@/models/PosDailySnapshot";
import { normalizeAppointmentStatus } from "@/components/pos/appointmentStatus";

export async function computeDailyStatsForDate(date) {
  const appointments = await PosAppointment.find({ date }).select("status");

  let sinConfirmar = 0;
  let pagadas = 0;
  let canceladas = 0;

  for (const appointment of appointments) {
    const status = normalizeAppointmentStatus(appointment.status);

    if (status === "agendado") sinConfirmar += 1;
    else if (status === "pagado") pagadas += 1;
    else if (status === "cancelled") canceladas += 1;
  }

  return {
    date,
    citas: appointments.length,
    sinConfirmar,
    pagadas,
    canceladas,
  };
}

export async function upsertDailySnapshot(date) {
  if (!date) return null;

  const stats = await computeDailyStatsForDate(date);

  await PosDailySnapshot.findOneAndUpdate(
    { date },
    { $set: stats },
    { upsert: true, new: true }
  );

  return stats;
}

export async function getDailySnapshotForDate(date) {
  const snapshot = await PosDailySnapshot.findOne({ date });

  if (snapshot) {
    return {
      date: snapshot.date,
      citas: snapshot.citas ?? 0,
      sinConfirmar: snapshot.sinConfirmar ?? 0,
      pagadas: snapshot.pagadas ?? 0,
      canceladas: snapshot.canceladas ?? 0,
    };
  }

  return computeDailyStatsForDate(date);
}

export async function refreshDailySnapshotsForDates(dates = []) {
  const uniqueDates = [...new Set(dates.filter(Boolean))];

  for (const date of uniqueDates) {
    await upsertDailySnapshot(date);
  }
}
