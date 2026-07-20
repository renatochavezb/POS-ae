import PosAppointment from "@/models/PosAppointment";
import PosPayment from "@/models/PosPayment";
import PosCashSession from "@/models/PosCashSession";
import PosStaff from "@/models/PosStaff";
import PosWeeklySnapshot from "@/models/PosWeeklySnapshot";
import { isAppointmentPaid } from "@/components/pos/appointmentStatus";
import {
  addDays,
  buildWeekDayEntries,
  formatSpanishShortDateInTimeZone,
  formatWeekRangeLabel,
  getStudioWeekStart,
} from "@/components/pos/scheduleUtils";
import { parseSpanishShortDateLabel } from "@/libs/spanishDateUtils";

const DEFAULT_COMMISSION_PERCENT = 40;

function roundPercent(current, previous) {
  if (!previous || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function getWeekStartDateLabelFromDateLabel(dateLabel) {
  const parsed = parseSpanishShortDateLabel(dateLabel);
  if (!parsed) return null;

  const weekStart = getStudioWeekStart(parsed);
  return formatSpanishShortDateInTimeZone(weekStart);
}

export function resolveWeekStartDateLabel(weekStartInput) {
  const trimmed = String(weekStartInput || "").trim();
  if (trimmed) {
    const parsed = parseSpanishShortDateLabel(trimmed);
    if (!parsed) return null;
    return formatSpanishShortDateInTimeZone(getStudioWeekStart(parsed));
  }

  return formatSpanishShortDateInTimeZone(getStudioWeekStart(new Date()));
}

function buildCommissionMap(staffMembers = []) {
  return new Map(
    staffMembers.map((member) => [
      member.staffCode,
      member.commissionPercent ?? DEFAULT_COMMISSION_PERCENT,
    ])
  );
}

function appointmentCommission(appointment, commissionByStaffId) {
  const cost = appointment.cost || 0;
  if (cost <= 0) return 0;
  const percent =
    commissionByStaffId.get(appointment.staffId) ?? DEFAULT_COMMISSION_PERCENT;
  return cost * (percent / 100);
}

function resolveStaffName(staffNameById, appointments, staffId) {
  return (
    staffNameById.get(staffId) ||
    appointments.find((appointment) => appointment.staffId === staffId)?.staffName ||
    staffId
  );
}

async function loadWeekContext(weekStartDateLabel) {
  const weekStartDate = parseSpanishShortDateLabel(weekStartDateLabel);
  if (!weekStartDate) {
    throw new Error("Semana inválida");
  }

  const weekDays = buildWeekDayEntries(weekStartDate);
  const dateLabels = weekDays.map((day) => day.dateLabel);
  const prevWeekStart = addDays(weekStartDate, -7);
  const previousWeekDays = buildWeekDayEntries(prevWeekStart);
  const previousDateLabels = previousWeekDays.map((day) => day.dateLabel);

  const [appointments, payments, cashSessions, staffMembers] = await Promise.all([
    PosAppointment.find({ date: { $in: dateLabels } }).select(
      "date staffId staffName cost status"
    ),
    PosPayment.find({ appointmentDate: { $in: dateLabels } }).select(
      "appointmentDate tip"
    ),
    PosCashSession.find({
      shiftDate: { $in: dateLabels },
      status: "closed",
    }).select(
      "sessionCode shiftDate totalAmount totalEfectivo totalTarjeta totalTransferencia paymentsCount closedByReceptionistId closedByReceptionistName openedByReceptionistId openedByReceptionistName closedAt openedAt"
    ),
    PosStaff.find({}).select("staffCode name commissionPercent"),
  ]);

  const previousAppointments = await PosAppointment.find({
    date: { $in: previousDateLabels },
  }).select("date cost status");

  const staffNameById = new Map(staffMembers.map((member) => [member.staffCode, member.name]));
  const commissionByStaffId = buildCommissionMap(staffMembers);

  return {
    weekStartDateLabel,
    weekEndDate: weekDays[weekDays.length - 1]?.dateLabel || weekStartDateLabel,
    weekRangeLabel: formatWeekRangeLabel(weekStartDate),
    weekDays,
    appointments,
    payments,
    cashSessions,
    previousAppointments,
    staffNameById,
    commissionByStaffId,
  };
}

export async function computeWeeklyStatsForWeekStart(weekStartDateLabel) {
  const context = await loadWeekContext(weekStartDateLabel);
  const {
    weekDays,
    appointments,
    payments,
    cashSessions,
    previousAppointments,
    staffNameById,
    commissionByStaffId,
  } = context;

  const completedAppointments = appointments.filter((appointment) =>
    isAppointmentPaid(appointment.status)
  );

  const completedByDay = weekDays.map((day) => ({
    dateLabel: day.dateLabel,
    dayLabel: day.dayLabel,
    count: completedAppointments.filter((appointment) => appointment.date === day.dateLabel)
      .length,
    sales: 0,
    commission: 0,
  }));

  const completedByStaffMap = new Map();
  completedAppointments.forEach((appointment) => {
    const current = completedByStaffMap.get(appointment.staffId) ?? {
      staffId: appointment.staffId,
      staffName: resolveStaffName(staffNameById, completedAppointments, appointment.staffId),
      count: 0,
      sales: 0,
      commission: 0,
      commissionPercent:
        commissionByStaffId.get(appointment.staffId) ?? DEFAULT_COMMISSION_PERCENT,
    };

    completedByStaffMap.set(appointment.staffId, {
      ...current,
      count: current.count + 1,
    });
  });

  const salesByDay = weekDays.map((day) => {
    const dayAppointments = completedAppointments.filter(
      (appointment) => appointment.date === day.dateLabel
    );
    const sales = dayAppointments.reduce(
      (sum, appointment) => sum + (appointment.cost || 0),
      0
    );
    const commission = dayAppointments.reduce(
      (sum, appointment) => sum + appointmentCommission(appointment, commissionByStaffId),
      0
    );

    return {
      dateLabel: day.dateLabel,
      dayLabel: day.dayLabel,
      count: dayAppointments.length,
      sales,
      commission,
    };
  });

  const salesByStaffMap = new Map();
  completedAppointments.forEach((appointment) => {
    const cost = appointment.cost || 0;
    const current = salesByStaffMap.get(appointment.staffId) ?? {
      staffId: appointment.staffId,
      staffName: resolveStaffName(staffNameById, completedAppointments, appointment.staffId),
      count: 0,
      sales: 0,
      commission: 0,
      commissionPercent:
        commissionByStaffId.get(appointment.staffId) ?? DEFAULT_COMMISSION_PERCENT,
    };

    salesByStaffMap.set(appointment.staffId, {
      ...current,
      count: current.count + 1,
      sales: current.sales + cost,
      commission: current.commission + appointmentCommission(appointment, commissionByStaffId),
    });
  });

  const grossSales = completedAppointments.reduce(
    (sum, appointment) => sum + (appointment.cost || 0),
    0
  );
  const estimatedCommission = completedAppointments.reduce(
    (sum, appointment) => sum + appointmentCommission(appointment, commissionByStaffId),
    0
  );
  const tips = payments.reduce((sum, payment) => sum + (payment.tip || 0), 0);
  const salonNet = grossSales - estimatedCommission - tips;

  const previousWeekCompleted = previousAppointments.filter((appointment) =>
    isAppointmentPaid(appointment.status)
  );
  const previousWeekCompletedCount = previousWeekCompleted.length;
  const previousWeekGrossSales = previousWeekCompleted.reduce(
    (sum, appointment) => sum + (appointment.cost || 0),
    0
  );

  const cutsByTurn = [...cashSessions]
    .sort(
      (a, b) =>
        new Date(b.closedAt || b.openedAt || 0).getTime() -
        new Date(a.closedAt || a.openedAt || 0).getTime()
    )
    .map((session) => ({
      sessionCode: session.sessionCode,
      shiftDate: session.shiftDate,
      totalAmount: session.totalAmount ?? 0,
      paymentsCount: session.paymentsCount ?? 0,
      receptionistName:
        session.closedByReceptionistName ||
        session.openedByReceptionistName ||
        "Recepción",
      closedAt: session.closedAt || session.openedAt || null,
    }));

  const cutsByReceptionistMap = new Map();
  cashSessions.forEach((session) => {
    const receptionistId =
      session.closedByReceptionistId || session.openedByReceptionistId || "";
    const name =
      session.closedByReceptionistName ||
      session.openedByReceptionistName ||
      receptionistId ||
      "Sin recepcionista";

    if (!receptionistId) return;

    const current = cutsByReceptionistMap.get(receptionistId) ?? {
      receptionistId,
      name,
      count: 0,
      total: 0,
    };

    cutsByReceptionistMap.set(receptionistId, {
      ...current,
      count: current.count + 1,
      total: current.total + (session.totalAmount || 0),
    });
  });

  const completedByStaff = [...completedByStaffMap.values()].sort(
    (a, b) => b.count - a.count || a.staffName.localeCompare(b.staffName)
  );
  const salesByStaff = [...salesByStaffMap.values()].sort(
    (a, b) => b.sales - a.sales || a.staffName.localeCompare(b.staffName)
  );
  const cutsByReceptionist = [...cutsByReceptionistMap.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name)
  );

  return {
    weekStartDate: context.weekStartDateLabel,
    weekEndDate: context.weekEndDate,
    weekRangeLabel: context.weekRangeLabel,
    completedAppointmentsCount: completedAppointments.length,
    completedByDay,
    completedByStaff,
    previousWeekCompletedCount,
    completedWeekDeltaPercent: roundPercent(
      completedAppointments.length,
      previousWeekCompletedCount
    ),
    grossSales,
    estimatedCommission,
    tips,
    salonNet,
    salesByDay,
    salesByStaff,
    previousWeekGrossSales,
    grossSalesWeekDeltaPercent: roundPercent(grossSales, previousWeekGrossSales),
    cutsCount: cutsByTurn.length,
    cutsTotal: cutsByTurn.reduce((sum, session) => sum + (session.totalAmount || 0), 0),
    cutsTotalEfectivo: cashSessions.reduce(
      (sum, session) => sum + (session.totalEfectivo || 0),
      0
    ),
    cutsTotalTarjeta: cashSessions.reduce(
      (sum, session) => sum + (session.totalTarjeta || 0),
      0
    ),
    cutsTotalTransferencia: cashSessions.reduce(
      (sum, session) => sum + (session.totalTransferencia || 0),
      0
    ),
    cutsByTurn,
    cutsByReceptionist,
    computedAt: new Date(),
  };
}

export async function upsertWeeklySnapshot(weekStartDateLabel) {
  const resolved = resolveWeekStartDateLabel(weekStartDateLabel);
  if (!resolved) return null;

  const stats = await computeWeeklyStatsForWeekStart(resolved);

  await PosWeeklySnapshot.findOneAndUpdate(
    { weekStartDate: resolved },
    { $set: stats },
    { upsert: true, new: true }
  );

  return stats;
}

export async function getWeeklySnapshotForWeekStart(weekStartDateLabel, { refresh = false } = {}) {
  const resolved = resolveWeekStartDateLabel(weekStartDateLabel);
  if (!resolved) return null;

  if (refresh) {
    return upsertWeeklySnapshot(resolved);
  }

  const snapshot = await PosWeeklySnapshot.findOne({ weekStartDate: resolved });
  if (snapshot) {
    return snapshot.toObject();
  }

  return upsertWeeklySnapshot(resolved);
}

export async function refreshWeeklySnapshotsForDates(dates = []) {
  const weekStarts = new Set();

  for (const date of dates.filter(Boolean)) {
    const weekStart = getWeekStartDateLabelFromDateLabel(date);
    if (weekStart) weekStarts.add(weekStart);
  }

  for (const weekStart of weekStarts) {
    await upsertWeeklySnapshot(weekStart);
  }
}

export async function refreshAllWeeklySnapshots() {
  const [appointmentDates, sessionDates] = await Promise.all([
    PosAppointment.distinct("date"),
    PosCashSession.distinct("shiftDate"),
  ]);

  const weekStarts = new Set();
  for (const date of [...appointmentDates, ...sessionDates].filter(Boolean)) {
    const weekStart = getWeekStartDateLabelFromDateLabel(date);
    if (weekStart) weekStarts.add(weekStart);
  }

  const refreshed = [];
  for (const weekStart of [...weekStarts].sort()) {
    refreshed.push(await upsertWeeklySnapshot(weekStart));
  }

  return refreshed;
}
