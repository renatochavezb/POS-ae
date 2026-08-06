import PosAppointment from "@/models/PosAppointment";
import PosPayment from "@/models/PosPayment";
import PosCashSession from "@/models/PosCashSession";
import PosStaff from "@/models/PosStaff";
import PosScheduleConfig from "@/models/PosScheduleConfig";
import PosWeeklySnapshot from "@/models/PosWeeklySnapshot";
import {
  isAppointmentCancelled,
  isAppointmentPaid,
} from "@/components/pos/appointmentStatus";
import {
  addDays,
  buildWeekDayEntries,
  DEFAULT_SCHEDULE_CONFIG,
  formatSpanishShortDateFromYmd,
  formatWeekRangeLabel,
  getMexicoDateYMD,
  getStudioWeekStartYmd,
  resolveScheduleForDate,
  spanishShortDateToYmd,
} from "@/components/pos/scheduleUtils";
import { parseSpanishShortDateLabel } from "@/libs/spanishDateUtils";
import { paymentMethodAmounts } from "@/libs/posCashRegister";

const DEFAULT_COMMISSION_PERCENT = 40;

function roundPercent(current, previous) {
  if (!previous || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function getWeekStartDateLabelFromDateLabel(dateLabel) {
  const ymd = spanishShortDateToYmd(dateLabel);
  if (!ymd) return null;
  return formatSpanishShortDateFromYmd(getStudioWeekStartYmd(ymd));
}

export function resolveWeekStartDateLabel(weekStartInput) {
  const trimmed = String(weekStartInput || "").trim();
  if (trimmed) {
    const ymd = spanishShortDateToYmd(trimmed);
    if (!ymd) return null;
    return formatSpanishShortDateFromYmd(getStudioWeekStartYmd(ymd));
  }

  return formatSpanishShortDateFromYmd(getStudioWeekStartYmd(getMexicoDateYMD(new Date())));
}

/** True si el label es exactamente el sábado de una semana operativa (sáb–vie). */
export function isCanonicalStudioWeekStartLabel(weekStartDateLabel) {
  const ymd = spanishShortDateToYmd(weekStartDateLabel);
  if (!ymd) return false;
  return getStudioWeekStartYmd(ymd) === ymd;
}

function weekStartYmdOrNull(weekStartDateLabel) {
  const ymd = spanishShortDateToYmd(weekStartDateLabel);
  if (!ymd) return null;
  return getStudioWeekStartYmd(ymd);
}

/** Snapshots huérfanos (no-sábado) o semanas futuras no deben aparecer en histórico/KPIs. */
function isUsableWeeklySnapshotDoc(doc, currentWeekStartYmd) {
  if (!doc?.weekStartDate) return false;
  const ymd = spanishShortDateToYmd(doc.weekStartDate);
  if (!ymd) return false;
  if (getStudioWeekStartYmd(ymd) !== ymd) return false;
  if (currentWeekStartYmd && ymd > currentWeekStartYmd) return false;
  return true;
}

function snapshotMissingStaffTips(snapshot) {
  const tips = Number(snapshot?.tips) || 0;
  if (tips <= 0) return false;
  const staff = snapshot?.salesByStaff || [];
  const staffTips = staff.reduce((sum, row) => sum + (Number(row?.tips) || 0), 0);
  return staffTips <= 0;
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
      "appointmentDate tip staffId staffName method total amount cashAmount cardAmount transferAmount giftCardAmount"
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
    tips: 0,
    net: 0,
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
    const dayPayments = payments.filter(
      (payment) => payment.appointmentDate === day.dateLabel
    );
    const dayTips = dayPayments.reduce((sum, payment) => sum + (payment.tip || 0), 0);
    const paymentBreakdown = dayPayments.reduce(
      (acc, payment) => {
        const methods = paymentMethodAmounts(payment);
        acc.efectivo += methods.efectivo;
        acc.tarjeta += methods.tarjeta;
        acc.transferencia += methods.transferencia;
        acc.gift_card += methods.gift_card;
        return acc;
      },
      { efectivo: 0, tarjeta: 0, transferencia: 0, gift_card: 0 }
    );
    const net = sales - commission - dayTips;

    return {
      dateLabel: day.dateLabel,
      dayLabel: day.dayLabel,
      count: dayAppointments.length,
      sales,
      commission,
      tips: dayTips,
      net,
      efectivo: paymentBreakdown.efectivo,
      tarjeta: paymentBreakdown.tarjeta,
      transferencia: paymentBreakdown.transferencia,
      gift_card: paymentBreakdown.gift_card,
    };
  });

  // Mantener completedByDay alineado con ventas (incluye tips/net)
  salesByDay.forEach((day, index) => {
    if (completedByDay[index]) {
      completedByDay[index].sales = day.sales;
      completedByDay[index].commission = day.commission;
      completedByDay[index].tips = day.tips;
      completedByDay[index].net = day.net;
    }
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
      tips: 0,
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

  payments.forEach((payment) => {
    const tip = payment.tip || 0;
    if (!payment.staffId || tip <= 0) return;
    const current = salesByStaffMap.get(payment.staffId) ?? {
      staffId: payment.staffId,
      staffName:
        payment.staffName ||
        staffNameById.get(payment.staffId) ||
        payment.staffId,
      count: 0,
      sales: 0,
      commission: 0,
      tips: 0,
      commissionPercent:
        commissionByStaffId.get(payment.staffId) ?? DEFAULT_COMMISSION_PERCENT,
    };
    salesByStaffMap.set(payment.staffId, {
      ...current,
      tips: current.tips + tip,
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
    const plain = snapshot.toObject();
    // Recomputar si faltan propinas por manicurista (snapshots viejos) o tip día a día.
    if (snapshotMissingStaffTips(plain)) {
      return upsertWeeklySnapshot(resolved);
    }
    return plain;
  }

  return upsertWeeklySnapshot(resolved);
}

export async function getAllWeeklySnapshots() {
  const currentWeekStartYmd = weekStartYmdOrNull(resolveWeekStartDateLabel(""));
  const docs = await PosWeeklySnapshot.find({}).lean();

  return docs
    .filter((doc) => isUsableWeeklySnapshotDoc(doc, currentWeekStartYmd))
    .sort((a, b) => {
      const da = parseSpanishShortDateLabel(a.weekStartDate);
      const db = parseSpanishShortDateLabel(b.weekStartDate);
      return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
    });
}

/** Elimina semanas no canónicas (p. ej. jue–mié) y semanas futuras vacías. */
export async function cleanupInvalidWeeklySnapshots() {
  const currentWeekStartYmd = weekStartYmdOrNull(resolveWeekStartDateLabel(""));
  const docs = await PosWeeklySnapshot.find({}).select("weekStartDate").lean();
  const toDelete = [];

  for (const doc of docs) {
    if (!isUsableWeeklySnapshotDoc(doc, currentWeekStartYmd)) {
      toDelete.push(doc.weekStartDate);
    }
  }

  if (toDelete.length > 0) {
    await PosWeeklySnapshot.deleteMany({ weekStartDate: { $in: toDelete } });
  }

  return { deleted: toDelete };
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
  const cleanup = await cleanupInvalidWeeklySnapshots();

  const [appointmentDates, sessionDates, paymentDates] = await Promise.all([
    PosAppointment.distinct("date"),
    PosCashSession.distinct("shiftDate"),
    PosPayment.distinct("appointmentDate"),
  ]);

  const currentWeekStartYmd = weekStartYmdOrNull(resolveWeekStartDateLabel(""));
  const weekStarts = new Set();
  for (const date of [...appointmentDates, ...sessionDates, ...paymentDates].filter(Boolean)) {
    const weekStart = getWeekStartDateLabelFromDateLabel(date);
    if (!weekStart) continue;
    const ymd = spanishShortDateToYmd(weekStart);
    if (!ymd) continue;
    // No materializar semanas futuras (distorsionan “última semana” del histórico).
    if (currentWeekStartYmd && ymd > currentWeekStartYmd) continue;
    weekStarts.add(weekStart);
  }

  const refreshed = [];
  for (const weekStart of [...weekStarts].sort()) {
    refreshed.push(await upsertWeeklySnapshot(weekStart));
  }

  return { snapshots: refreshed, cleanup };
}

function emptyStaffWeekMetrics(staffId, staffName) {
  return {
    staffId,
    staffName,
    citas: 0,
    bruta: 0,
    comision: 0,
    neta: 0,
    tip: 0,
    ticketPromedio: 0,
    cancelled: 0,
    productiveHours: 0,
    availableHours: 0,
    occupancyPct: null,
    recurrentClients: 0,
    newClients: 0,
  };
}

function availableHoursForWeek(weekStartDate, scheduleConfig) {
  const days = buildWeekDayEntries(weekStartDate);
  return days.reduce((sum, day) => {
    const schedule = resolveScheduleForDate(day.date, scheduleConfig);
    if (schedule.closed) return sum;
    return sum + Math.max(0, schedule.endHour - schedule.startHour);
  }, 0);
}

/**
 * Histórico por manicurista: combina snapshots semanales (ventas)
 * con citas vivas (cancelaciones, horas, clientes nuevos/recurrentes).
 */
export async function buildStaffPerformanceHistory({ refreshCurrent = false } = {}) {
  const currentWeekStart = resolveWeekStartDateLabel("");
  if (refreshCurrent && currentWeekStart) {
    await upsertWeeklySnapshot(currentWeekStart);
  }

  const [snapshots, scheduleDoc] = await Promise.all([
    getAllWeeklySnapshots(),
    PosScheduleConfig.findOne({ configCode: "default" }).lean(),
  ]);

  const scheduleConfig = {
    ...DEFAULT_SCHEDULE_CONFIG,
    ...(scheduleDoc || {}),
    weeklyHours: {
      ...DEFAULT_SCHEDULE_CONFIG.weeklyHours,
      ...(scheduleDoc?.weeklyHours || {}),
    },
  };

  const weekMetas = snapshots
    .map((snapshot) => {
      const weekStartDate = snapshot.weekStartDate;
      const weekStart = parseSpanishShortDateLabel(weekStartDate);
      if (!weekStart) return null;
      const days = buildWeekDayEntries(weekStart);
      return {
        weekStartDate,
        weekEndDate: snapshot.weekEndDate || days[days.length - 1]?.dateLabel || "",
        weekRangeLabel: snapshot.weekRangeLabel || formatWeekRangeLabel(weekStart),
        weekStart,
        dateLabels: days.map((day) => day.dateLabel),
        salesByStaff: snapshot.salesByStaff || [],
        availableHours: availableHoursForWeek(weekStart, scheduleConfig),
      };
    })
    .filter(Boolean);

  const allDateLabels = [...new Set(weekMetas.flatMap((week) => week.dateLabels))];

  const appointments =
    allDateLabels.length > 0
      ? await PosAppointment.find({ date: { $in: allDateLabels } }).select(
          "date staffId staffName clientId status cost duration"
        )
      : [];

  const payments =
    allDateLabels.length > 0
      ? await PosPayment.find({ appointmentDate: { $in: allDateLabels } }).select(
          "appointmentDate tip staffId staffName"
        )
      : [];

  const tipsByWeekStaff = new Map();
  for (const week of weekMetas) {
    const dateSet = new Set(week.dateLabels);
    for (const payment of payments) {
      if (!payment.staffId || !dateSet.has(payment.appointmentDate)) continue;
      const tip = payment.tip || 0;
      if (tip <= 0) continue;
      const key = `${week.weekStartDate}::${payment.staffId}`;
      const current = tipsByWeekStaff.get(key) || {
        tip: 0,
        staffName: payment.staffName || payment.staffId,
      };
      tipsByWeekStaff.set(key, {
        tip: current.tip + tip,
        staffName: current.staffName,
      });
    }
  }
  // Primera cita pagada por (staffId, clientId) en el historial cargado.
  const firstPaidByStaffClient = new Map();
  const paidSorted = appointments
    .filter((appointment) => isAppointmentPaid(appointment.status))
    .slice()
    .sort((a, b) => {
      const da = parseSpanishShortDateLabel(a.date)?.getTime() || 0;
      const db = parseSpanishShortDateLabel(b.date)?.getTime() || 0;
      return da - db;
    });

  for (const appointment of paidSorted) {
    const key = `${appointment.staffId}::${appointment.clientId}`;
    if (!firstPaidByStaffClient.has(key)) {
      firstPaidByStaffClient.set(key, appointment.date);
    }
  }

  const appointmentsByWeekStaff = new Map();
  for (const week of weekMetas) {
    const dateSet = new Set(week.dateLabels);
    for (const appointment of appointments) {
      if (!dateSet.has(appointment.date)) continue;
      const key = `${week.weekStartDate}::${appointment.staffId}`;
      if (!appointmentsByWeekStaff.has(key)) {
        appointmentsByWeekStaff.set(key, []);
      }
      appointmentsByWeekStaff.get(key).push(appointment);
    }
  }

  const staffDirectory = new Map();

  const weeks = weekMetas.map((week) => {
    const staffMap = new Map();

    for (const entry of week.salesByStaff) {
      if (!entry?.staffId) continue;
      const metrics = emptyStaffWeekMetrics(entry.staffId, entry.staffName || entry.staffId);
      metrics.citas = entry.count ?? 0;
      metrics.bruta = entry.sales ?? 0;
      metrics.comision = entry.commission ?? 0;
      metrics.tip = entry.tips ?? 0;
      metrics.neta = metrics.bruta - metrics.comision - metrics.tip;
      metrics.ticketPromedio =
        metrics.citas > 0 ? Math.round((metrics.bruta / metrics.citas) * 100) / 100 : 0;
      metrics.availableHours = week.availableHours;
      staffMap.set(entry.staffId, metrics);
      staffDirectory.set(entry.staffId, metrics.staffName);
    }

    // Completar / enriquecer con citas (incluye staff sin ventas en snapshot).
    const staffIdsInWeek = new Set([
      ...staffMap.keys(),
      ...[...appointmentsByWeekStaff.keys()]
        .filter((key) => key.startsWith(`${week.weekStartDate}::`))
        .map((key) => key.slice(week.weekStartDate.length + 2)),
      ...[...tipsByWeekStaff.keys()]
        .filter((key) => key.startsWith(`${week.weekStartDate}::`))
        .map((key) => key.slice(week.weekStartDate.length + 2)),
    ]);

    for (const staffId of staffIdsInWeek) {
      const weekAppts = appointmentsByWeekStaff.get(`${week.weekStartDate}::${staffId}`) || [];
      const tipEntry = tipsByWeekStaff.get(`${week.weekStartDate}::${staffId}`);
      const existing = staffMap.get(staffId);
      const staffName =
        existing?.staffName ||
        weekAppts[0]?.staffName ||
        tipEntry?.staffName ||
        staffDirectory.get(staffId) ||
        staffId;
      const metrics = existing || emptyStaffWeekMetrics(staffId, staffName);
      metrics.staffName = staffName;
      metrics.availableHours = week.availableHours;

      // Prefer tip from live payments; fallback to snapshot field already set.
      if (tipEntry) {
        metrics.tip = tipEntry.tip;
      }
      metrics.neta = metrics.bruta - metrics.comision - metrics.tip;

      const paid = weekAppts.filter((appointment) => isAppointmentPaid(appointment.status));
      const cancelled = weekAppts.filter((appointment) =>
        isAppointmentCancelled(appointment.status)
      );

      // Si no había snapshot, calcular dinero desde citas pagadas.
      if (!existing && paid.length > 0) {
        metrics.citas = paid.length;
        metrics.bruta = paid.reduce((sum, appointment) => sum + (appointment.cost || 0), 0);
        metrics.comision = 0;
        metrics.ticketPromedio =
          metrics.citas > 0 ? Math.round((metrics.bruta / metrics.citas) * 100) / 100 : 0;
      }

      metrics.neta = metrics.bruta - metrics.comision - metrics.tip;

      metrics.cancelled = cancelled.length;
      metrics.productiveHours =
        Math.round(
          (paid.reduce((sum, appointment) => sum + (appointment.duration || 60), 0) / 60) * 10
        ) / 10;

      if (metrics.availableHours > 0) {
        metrics.occupancyPct = Math.round(
          (metrics.productiveHours / metrics.availableHours) * 100
        );
      }

      const clientsInWeek = new Set(paid.map((appointment) => appointment.clientId).filter(Boolean));
      let recurrent = 0;
      let neu = 0;
      for (const clientId of clientsInWeek) {
        const firstDate = firstPaidByStaffClient.get(`${staffId}::${clientId}`);
        if (firstDate && week.dateLabels.includes(firstDate)) {
          neu += 1;
        } else {
          recurrent += 1;
        }
      }
      metrics.recurrentClients = recurrent;
      metrics.newClients = neu;

      staffMap.set(staffId, metrics);
      staffDirectory.set(staffId, staffName);
    }

    return {
      weekStartDate: week.weekStartDate,
      weekEndDate: week.weekEndDate,
      weekRangeLabel: week.weekRangeLabel,
      staff: [...staffMap.values()].sort(
        (a, b) => b.bruta - a.bruta || a.staffName.localeCompare(b.staffName)
      ),
    };
  });

  return {
    weeks,
    staff: [...staffDirectory.entries()]
      .map(([staffId, staffName]) => ({ staffId, staffName }))
      .sort((a, b) => a.staffName.localeCompare(b.staffName)),
  };
}
