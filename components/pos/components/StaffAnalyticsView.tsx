"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Download,
  Sliders,
  Star,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { Staff, Appointment, StaffSettlement, PosPayment } from '../types';
import { formatServicePrice, formatMXN } from '../data';
import {
  getAppointmentStatusLabel,
  getAppointmentStatusStyles,
  isAppointmentCancelled,
  isAppointmentPaid,
} from '../appointmentStatus';
import {
  addDays,
  buildWeekDayEntries,
  formatSpanishShortDateInTimeZone,
  formatWeekRangeLabel,
  getMexicoDateYMD,
  getStudioWeekStart,
  getTodaySpanishShortDate,
  isCurrentWeek,
} from '../scheduleUtils';
import { compareSpanishShortDates } from '@/libs/spanishDateUtils';
import posApi from '@/libs/posApi';
import StaffEditProfileModal from './StaffEditProfileModal';
import StaffReportModal from './StaffReportModal';
import StaffLiquidateModal from './StaffLiquidateModal';
import AccountantActivityPanel from './AccountantActivityPanel';
import AccountantDiscountsPanel from './AccountantDiscountsPanel';
import {
  collectDiscountRows,
  sumDiscountForPerson,
} from '@/libs/posPaymentDiscounts';
import { warrantyMovementsForStaff } from '@/libs/posWarranty';

type WorkHistoryMode = 'day' | 'period';

function dateFromMexicoYmd(ymd: string): Date {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, month - 1, day);
}

interface StaffAnalyticsViewProps {
  staff: Staff;
  appointments: Appointment[];
  onBack: () => void;
  onStaffUpdated?: (updated: Staff) => void;
  isAccountantSession?: boolean;
  loggedInAccountant?: { id: string; name: string } | null;
  showAccountantBitacora?: boolean;
  onAccountantActivity?: () => void;
  activityRefreshKey?: number;
  readOnly?: boolean;
  hideBack?: boolean;
  onRefreshAppointments?: () => void | Promise<void>;
  isRefreshingAppointments?: boolean;
}

export default function StaffAnalyticsView({
  staff,
  appointments,
  onBack,
  onStaffUpdated,
  isAccountantSession = false,
  loggedInAccountant = null,
  showAccountantBitacora = false,
  onAccountantActivity,
  activityRefreshKey = 0,
  readOnly = false,
  hideBack = false,
  onRefreshAppointments,
  isRefreshingAppointments = false,
}: StaffAnalyticsViewProps) {
  const [weekStart, setWeekStart] = useState<Date>(() => getStudioWeekStart(new Date()));
  const [workHistoryMode, setWorkHistoryMode] = useState<WorkHistoryMode>('day');
  const [workDayDate, setWorkDayDate] = useState<Date>(() => new Date());
  const [periodStart, setPeriodStart] = useState<Date>(() => getStudioWeekStart(new Date()));
  const [periodEnd, setPeriodEnd] = useState<Date>(() => addDays(getStudioWeekStart(new Date()), 6));
  const [settlements, setSettlements] = useState<StaffSettlement[]>([]);
  const [weekPayments, setWeekPayments] = useState<PosPayment[]>([]);
  const [isLoadingTips, setIsLoadingTips] = useState(false);
  const [isLiquidateModalOpen, setIsLiquidateModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editProfileError, setEditProfileError] = useState<string | null>(null);

  const todayLabel = getTodaySpanishShortDate();
  const workDayLabel = formatSpanishShortDateInTimeZone(workDayDate);
  const periodStartLabel = formatSpanishShortDateInTimeZone(periodStart);
  const periodEndLabel = formatSpanishShortDateInTimeZone(periodEnd);
  const isWorkDayToday = workDayLabel === todayLabel;
  const weekRangeLabel = formatWeekRangeLabel(weekStart);
  const viewingCurrentWeek = isCurrentWeek(weekStart);
  const latestSettlement = settlements[0] ?? null;
  const weekDays = useMemo(() => buildWeekDayEntries(weekStart), [weekStart]);

  useEffect(() => {
    let cancelled = false;

    posApi
      .getStaffSettlements(staff.id)
      .then((items) => {
        if (!cancelled) setSettlements(items);
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, [staff.id]);

  useEffect(() => {
    let cancelled = false;

    const loadWeekTips = async () => {
      setIsLoadingTips(true);
      try {
        const results = await Promise.all(
          weekDays.map((day) => posApi.getPayments({ date: day.dateLabel }))
        );
        if (!cancelled) {
          setWeekPayments(results.flatMap((result) => result.payments || []));
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setWeekPayments([]);
      } finally {
        if (!cancelled) setIsLoadingTips(false);
      }
    };

    loadWeekTips();

    return () => {
      cancelled = true;
    };
  }, [weekDays]);

  const weeklyPerformance = useMemo(() => {
    return weekDays.map((day) => ({
      ...day,
      sales: appointments
        .filter(
          (appointment) =>
            appointment.staffId === staff.id &&
            isAppointmentPaid(appointment.status) &&
            appointment.date === day.dateLabel
        )
        .reduce((sum, appointment) => sum + (appointment.cost || 0), 0),
    }));
  }, [appointments, staff.id, weekDays]);

  const weekTotalSales = weeklyPerformance.reduce((sum, day) => sum + day.sales, 0);
  const weekGrossCommission = weekTotalSales * (staff.commissionPercent / 100);
  const weekStaffDiscount = sumDiscountForPerson(weekPayments, 'staff', staff.id);
  const weekStaffDiscountRows = useMemo(
    () =>
      collectDiscountRows(weekPayments).filter(
        (row) =>
          row.role === 'staff' &&
          String(row.id).trim().toUpperCase() === String(staff.id).trim().toUpperCase()
      ),
    [weekPayments, staff.id]
  );
  const weekWarrantyMovements = useMemo(
    () => warrantyMovementsForStaff(weekPayments, staff.id),
    [weekPayments, staff.id]
  );
  const weekWarrantyNet = weekWarrantyMovements.reduce(
    (sum, row) => sum + (row.signedAmount || 0),
    0
  );
  const weekWarrantyCount = weekWarrantyMovements.length;
  const weekTotalCommission = Math.max(
    0,
    weekGrossCommission - weekStaffDiscount + weekWarrantyNet
  );
  const weekTotalTips = weekPayments
    .filter((payment) => payment.staffId === staff.id)
    .reduce((sum, payment) => sum + (payment.tip || 0), 0);
  const weekTotalCommissionAndTips = weekTotalCommission + weekTotalTips;
  const chartMax = Math.max(500, ...weeklyPerformance.map((day) => day.sales), 1);

  const paymentDiscountByAppointment = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of weekStaffDiscountRows) {
      if (!row.appointmentId) continue;
      map.set(row.appointmentId, (map.get(row.appointmentId) || 0) + row.amount);
    }
    return map;
  }, [weekStaffDiscountRows]);

  const workHistoryAppointments = useMemo(() => {
    const base = appointments.filter(
      (app) => app.staffId === staff.id && !isAppointmentCancelled(app.status)
    );

    const filtered =
      workHistoryMode === 'day'
        ? base.filter((app) => app.date === workDayLabel)
        : base.filter((app) => {
            const afterStart = compareSpanishShortDates(app.date, periodStartLabel) >= 0;
            const beforeEnd = compareSpanishShortDates(app.date, periodEndLabel) <= 0;
            return afterStart && beforeEnd;
          });

    return filtered
      .sort((a, b) => {
        const byDate = compareSpanishShortDates(a.date, b.date);
        if (byDate !== 0) return byDate;
        return a.time.localeCompare(b.time);
      })
      .map((app) => {
        const grossCommission =
          app.cost > 0 && isAppointmentPaid(app.status)
            ? app.cost * (staff.commissionPercent / 100)
            : 0;
        const discount = paymentDiscountByAppointment.get(app.id) || 0;
        return {
          id: app.id,
          date: app.date,
          time: app.time,
          clientName: app.clientName,
          badge: 'Cliente',
          service: app.serviceName,
          cost: app.cost,
          status: app.status,
          isPaid: isAppointmentPaid(app.status),
          discount,
          commission: Math.max(0, grossCommission - discount),
        };
      });
  }, [
    appointments,
    staff.id,
    staff.commissionPercent,
    workHistoryMode,
    workDayLabel,
    periodStartLabel,
    periodEndLabel,
    paymentDiscountByAppointment,
  ]);

  const totalWorkSales = workHistoryAppointments.reduce(
    (sum, item) => sum + (item.isPaid ? item.cost : 0),
    0
  );
  const totalWorkCommission = workHistoryAppointments.reduce(
    (sum, item) => sum + item.commission,
    0
  );

  const workHistorySubtitle =
    workHistoryMode === 'day'
      ? `${workDayLabel} · comisión ${staff.commissionPercent}%`
      : `${periodStartLabel} – ${periodEndLabel} · comisión ${staff.commissionPercent}%`;

  const handlePrevWeek = () => setWeekStart((prev) => addDays(prev, -7));
  const handleNextWeek = () => setWeekStart((prev) => addDays(prev, 7));
  const handleGoToCurrentWeek = () => setWeekStart(getStudioWeekStart(new Date()));

  const handlePrevWorkDay = () => setWorkDayDate((prev) => addDays(prev, -1));
  const handleNextWorkDay = () => setWorkDayDate((prev) => addDays(prev, 1));
  const handleGoToTodayWork = () => setWorkDayDate(new Date());

  const applyChartWeekToPeriod = () => {
    setPeriodStart(weekStart);
    setPeriodEnd(addDays(weekStart, 6));
    setWorkHistoryMode('period');
  };

  const handleRequestPayment = () => {
    setIsLiquidateModalOpen(true);
  };

  const handleSettlementRecorded = (settlement: StaffSettlement) => {
    setSettlements((prev) => [settlement, ...prev.filter((item) => item.id !== settlement.id)]);
    onAccountantActivity?.();
  };

  const settlementStatusLabel = latestSettlement ? 'Liquidado' : 'Por liquidar';
  const settlementStatusDetail = latestSettlement
    ? `Última liquidación: ${latestSettlement.settledDateLabel} · ${
        latestSettlement.periodStartLabel === latestSettlement.periodEndLabel
          ? latestSettlement.periodStartLabel
          : `${latestSettlement.periodStartLabel} – ${latestSettlement.periodEndLabel}`
      } · ${formatMXN(latestSettlement.paidAmount)} pagados`
    : 'Sin liquidaciones registradas para esta manicurista.';

  const handleOpenEditProfile = () => {
    setEditProfileError(null);
    setIsEditProfileOpen(true);
  };

  const handleCloseEditProfile = () => {
    if (isSavingProfile) return;
    setEditProfileError(null);
    setIsEditProfileOpen(false);
  };

  const handleSaveProfile = async (data: {
    name: string;
    role: string;
    specialty: string;
    shift: string;
    email: string;
    phone: string;
    rating: number;
    commissionPercent: number;
    bio: string;
    image: string;
  }) => {
    setIsSavingProfile(true);
    setEditProfileError(null);

    try {
      const updated = await posApi.updateStaff(staff.id, data);
      onStaffUpdated?.(updated);
      setIsEditProfileOpen(false);
    } catch (error) {
      console.error(error);
      setEditProfileError('No se pudo guardar el perfil. Intenta de nuevo.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleManualRefresh = async () => {
    if (isRefreshingAppointments) return;
    try {
      await onRefreshAppointments?.();
      setIsLoadingTips(true);
      const results = await Promise.all(
        weekDays.map((day) => posApi.getPayments({ date: day.dateLabel }))
      );
      setWeekPayments(results.flatMap((result) => result.payments || []));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingTips(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in p-1 md:p-6 max-w-7xl mx-auto">
      {!hideBack && (
      <div>
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-outline hover:text-primary text-xs font-bold uppercase tracking-widest transition-colors font-sans"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1 text-secondary" />
          <span>Volver al Listado</span>
        </button>
      </div>
      )}

      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img
            referrerPolicy="no-referrer"
            src={staff.image}
            alt={staff.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-primary/10 shadow-sm bg-surface-container-low"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl font-bold text-primary">{staff.name}</h2>
              <div className="flex items-center text-amber-500 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span className="text-[10px] font-bold ml-0.5 text-amber-800">
                  {staff.rating.toFixed(1)} Star Artist
                </span>
              </div>
            </div>
            <p className="text-xs text-outline font-bold uppercase tracking-wider mt-0.5">
              {staff.role}
            </p>
            <p className="text-xs text-on-surface-variant font-medium mt-1">
              Especialidad: {staff.specialty}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {onRefreshAppointments ? (
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              disabled={isRefreshingAppointments || isLoadingTips}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-primary/10 text-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-surface-container-low transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  isRefreshingAppointments || isLoadingTips ? 'animate-spin' : ''
                }`}
              />
              <span>
                {isRefreshingAppointments || isLoadingTips ? 'Actualizando…' : 'Actualizar'}
              </span>
            </button>
          ) : null}
          {!readOnly && (
          <>
          {!isAccountantSession && (
          <button
            type="button"
            onClick={handleOpenEditProfile}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-primary/10 text-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-surface-container-low transition-colors"
          >
            <Sliders className="w-4 h-4 text-secondary" />
            <span>Editar Perfil</span>
          </button>
          )}
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-primary/10 text-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-surface-container-low transition-colors"
          >
            <Download className="w-4 h-4 text-secondary" />
            <span>Descargar reporte</span>
          </button>
          </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow flex items-start justify-between">
          <div className="space-y-3">
            <span className="text-[10px] text-outline font-bold tracking-widest uppercase block">
              Total generado (semana)
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-3xl font-black text-primary">
                {formatMXN(weekTotalSales)}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">{weekRangeLabel}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
            <TrendingUp className="w-6 h-6 text-secondary" />
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow flex items-start justify-between">
          <div className="space-y-3">
            <span className="text-[10px] text-outline font-bold tracking-widest uppercase block">
              Comisión (semana)
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-3xl font-black text-secondary">
                {isLoadingTips ? '—' : formatMXN(weekTotalCommission)}
              </span>
              <span className="text-[10px] text-outline font-sans ml-1">
                ({staff.commissionPercent}%)
              </span>
            </div>
            {weekStaffDiscount > 0 ? (
              <p className="text-xs text-amber-800 font-medium">
                Bruta {formatMXN(weekGrossCommission)} − descuentos{' '}
                {formatMXN(weekStaffDiscount)}
                {weekWarrantyNet !== 0
                  ? ` ${weekWarrantyNet > 0 ? '+' : ''}garantías ${formatMXN(weekWarrantyNet)}`
                  : ''}
              </p>
            ) : weekWarrantyNet !== 0 ? (
              <p className="text-xs text-amber-800 font-medium">
                Incluye garantías {weekWarrantyNet > 0 ? '+' : ''}
                {formatMXN(weekWarrantyNet)} · {weekWarrantyCount} registro
                {weekWarrantyCount === 1 ? '' : 's'}
              </p>
            ) : (
              <p className="text-xs text-on-surface-variant">
                Calculada sobre citas terminadas de la semana.
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
            <Coins className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow flex items-start justify-between">
          <div className="space-y-3 min-w-0">
            <span className="text-[10px] text-outline font-bold tracking-widest uppercase block">
              Propinas de la semana
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-3xl font-black text-primary">
                {isLoadingTips ? '—' : formatMXN(weekTotalTips)}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Cobrado en caja · {weekRangeLabel}
            </p>
            <p className="text-[11px] font-bold text-secondary pt-2 border-t border-primary/10">
              Comisión + propinas:{' '}
              {isLoadingTips ? '—' : formatMXN(weekTotalCommissionAndTips)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
            <Star className="w-6 h-6 text-secondary" />
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow flex flex-col justify-between">
          <div className="space-y-2">
            <span className="text-[10px] text-outline font-bold tracking-widest uppercase block">
              Estado liquidación
            </span>
            <div className="text-xs font-bold text-primary flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  latestSettlement ? 'bg-emerald-500' : 'bg-primary'
                }`}
              />
              <span className="uppercase tracking-wide">{settlementStatusLabel}</span>
            </div>
            <p className="text-[11px] text-outline leading-tight">{settlementStatusDetail}</p>
          </div>
          {!readOnly && (
          <button
            type="button"
            onClick={handleRequestPayment}
            className="w-full mt-4 py-2 rounded-lg text-center text-[10px] font-sans font-bold uppercase tracking-widest transition-all bg-primary text-on-primary hover:bg-primary-container"
          >
            Liquidar
          </button>
          )}
        </div>
      </div>

      {(weekStaffDiscount > 0 || weekStaffDiscountRows.length > 0) && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 md:p-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-bold text-primary">
                Descuentos de tu comisión
              </h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Se restan de tu liquidación · {weekRangeLabel}
              </p>
            </div>
            <p className="font-display text-2xl font-black text-amber-900">
              −{formatMXN(weekStaffDiscount)}
            </p>
          </div>
          <ul className="space-y-2">
            {weekStaffDiscountRows.map((row, index) => (
              <li
                key={`${row.paymentId}-${index}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs border-t border-amber-200/80 pt-2 first:border-0 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="font-bold text-primary">
                    {row.clientName || 'Cliente'} · {row.serviceName || 'Servicio'}
                  </p>
                  <p className="text-outline mt-0.5">
                    {row.appointmentDate || '—'}
                    {row.percent > 0 ? ` · ${row.percent}%` : ''}
                    {row.reason ? ` · ${row.reason}` : ''}
                  </p>
                </div>
                <span className="font-display font-black text-amber-900 shrink-0">
                  −{formatMXN(row.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {weekWarrantyCount > 0 && (
        <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-5 md:p-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-bold text-primary">Garantías</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                {weekWarrantyCount} esta semana · calidad del trabajo · {weekRangeLabel}
              </p>
            </div>
            <p
              className={`font-display text-2xl font-black ${
                weekWarrantyNet < 0
                  ? 'text-rose-800'
                  : weekWarrantyNet > 0
                    ? 'text-emerald-800'
                    : 'text-primary'
              }`}
            >
              {weekWarrantyNet > 0 ? '+' : ''}
              {formatMXN(weekWarrantyNet)}
            </p>
          </div>
          <ul className="space-y-2">
            {weekWarrantyMovements.map((row, index) => (
              <li
                key={`${row.paymentId}-${row.type}-${index}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs border-t border-rose-200/80 pt-2 first:border-0 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="font-bold text-primary">
                    {row.clientName || 'Cliente'} · {row.workDescription}
                  </p>
                  <p className="text-outline mt-0.5">
                    {row.appointmentDate || '—'} · {row.label}
                  </p>
                </div>
                <span
                  className={`font-display font-black shrink-0 ${
                    row.signedAmount < 0
                      ? 'text-rose-800'
                      : row.signedAmount > 0
                        ? 'text-emerald-800'
                        : 'text-outline'
                  }`}
                >
                  {row.type === 'same'
                    ? 'Sin traspaso'
                    : `${row.signedAmount > 0 ? '+' : '−'}${formatMXN(Math.abs(row.signedAmount))}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h3 className="font-display text-lg font-bold text-primary">
                Ventas diarias de la semana
              </h3>
              <p className="text-xs text-outline mt-1">
                Citas terminadas en Mongo · {weekRangeLabel}
              </p>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-primary/10 bg-surface px-1 py-1 self-start">
              <button
                type="button"
                onClick={handlePrevWeek}
                title="Semana anterior"
                className="p-1.5 rounded-lg hover:bg-surface-container-low text-primary transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleGoToCurrentWeek}
                disabled={viewingCurrentWeek}
                className={`px-3 py-1 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider transition-colors ${
                  viewingCurrentWeek
                    ? 'bg-primary text-on-primary cursor-default'
                    : 'text-primary hover:bg-surface-container-low'
                }`}
              >
                Semana actual
              </button>
              <button
                type="button"
                onClick={handleNextWeek}
                title="Semana siguiente"
                className="p-1.5 rounded-lg hover:bg-surface-container-low text-primary transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="pt-2">
            <div className="h-64 w-full flex items-end justify-between gap-3 px-2 border-b border-primary/10">
              {weeklyPerformance.map((item) => {
                const percentHeight = Math.min((item.sales / chartMax) * 100, 100);
                const isToday = item.dateLabel === todayLabel;

                return (
                  <div
                    key={item.dateLabel}
                    className="flex-1 flex flex-col items-center gap-2 group h-full justify-end min-w-0"
                  >
                    <span className="text-[9px] font-mono font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-on-primary px-1.5 py-0.5 rounded -translate-y-1 whitespace-nowrap">
                      {formatMXN(item.sales)}
                    </span>
                    <div
                      style={{ height: `${Math.max(percentHeight, item.sales > 0 ? 4 : 0)}%` }}
                      className={`w-full rounded-t-lg transition-all duration-500 relative group-hover:bg-secondary min-h-[2px] ${
                        isToday ? 'bg-secondary' : 'bg-primary/20'
                      }`}
                    >
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 rounded-t-lg transition-opacity" />
                    </div>
                    <div className="text-center min-w-0">
                      <span className="text-[10px] text-outline font-bold block">{item.dayLabel}</span>
                      <span className="text-[8px] text-outline/80 font-mono truncate block max-w-full">
                        {item.dateLabel.replace(/, \d{4}$/, '')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[10px] text-outline font-mono mt-3 px-2">
              <span>Cero ventas</span>
              <span>Total semana: {formatMXN(weekTotalSales)}</span>
              <span>Máx: {formatMXN(chartMax)}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-[10px] text-outline uppercase font-bold tracking-widest block border-b border-primary/5 pb-2">
              Biografía
            </span>
            <p className="text-xs text-on-surface-variant leading-relaxed font-sans font-medium">
              &ldquo;{staff.bio || 'Sin biografía registrada.'}&rdquo;
            </p>

            <div className="pt-4 space-y-3.5">
              <p className="text-[10px] text-outline uppercase font-bold tracking-widest">
                Turno y contacto
              </p>
              <div className="flex flex-col gap-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-outline">Turno</span>
                  <span className="font-bold text-primary">{staff.shift}</span>
                </div>
                {staff.email ? (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-outline shrink-0">Correo</span>
                    <span className="font-bold text-primary truncate">{staff.email}</span>
                  </div>
                ) : null}
                {staff.phone ? (
                  <div className="flex justify-between items-center">
                    <span className="text-outline">Teléfono</span>
                    <span className="font-bold text-primary">{staff.phone}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-500/[0.03] rounded-xl border border-emerald-500/10 text-xs text-emerald-900 font-medium flex items-start gap-2.5 mt-6">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              Las ventas del gráfico provienen de citas con estatus terminado en la base de datos.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden">
        <div className="p-6 border-b border-primary/5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <h3 className="font-display text-lg font-bold text-primary">
                Historial de trabajos
              </h3>
              <p className="text-xs text-outline mt-1">{workHistorySubtitle}</p>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-primary/10 bg-surface p-1 self-start">
              <button
                type="button"
                onClick={() => setWorkHistoryMode('day')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider transition-colors ${
                  workHistoryMode === 'day'
                    ? 'bg-primary text-on-primary'
                    : 'text-primary hover:bg-surface-container-low'
                }`}
              >
                Un día
              </button>
              <button
                type="button"
                onClick={() => setWorkHistoryMode('period')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider transition-colors ${
                  workHistoryMode === 'period'
                    ? 'bg-primary text-on-primary'
                    : 'text-primary hover:bg-surface-container-low'
                }`}
              >
                Periodo
              </button>
            </div>
          </div>

          {workHistoryMode === 'day' ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-xl border border-primary/10 bg-surface px-1 py-1">
                <button
                  type="button"
                  onClick={handlePrevWorkDay}
                  title="Día anterior"
                  className="p-1.5 rounded-lg hover:bg-surface-container-low text-primary transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleGoToTodayWork}
                  disabled={isWorkDayToday}
                  className={`px-3 py-1 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider transition-colors ${
                    isWorkDayToday
                      ? 'bg-primary text-on-primary cursor-default'
                      : 'text-primary hover:bg-surface-container-low'
                  }`}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={handleNextWorkDay}
                  title="Día siguiente"
                  className="p-1.5 rounded-lg hover:bg-surface-container-low text-primary transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                <Calendar className="w-3.5 h-3.5 text-secondary" />
                {workDayLabel}
              </span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
              <label className="space-y-1">
                <span className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                  Desde
                </span>
                <input
                  type="date"
                  value={getMexicoDateYMD(periodStart)}
                  onChange={(event) => {
                    const next = dateFromMexicoYmd(event.target.value);
                    setPeriodStart(next);
                    if (compareSpanishShortDates(formatSpanishShortDateInTimeZone(next), periodEndLabel) > 0) {
                      setPeriodEnd(next);
                    }
                  }}
                  className="px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                  Hasta
                </span>
                <input
                  type="date"
                  value={getMexicoDateYMD(periodEnd)}
                  onChange={(event) => {
                    const next = dateFromMexicoYmd(event.target.value);
                    setPeriodEnd(next);
                    if (compareSpanishShortDates(formatSpanishShortDateInTimeZone(next), periodStartLabel) < 0) {
                      setPeriodStart(next);
                    }
                  }}
                  className="px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                />
              </label>
              <button
                type="button"
                onClick={applyChartWeekToPeriod}
                className="px-3 py-2 rounded-lg border border-primary/10 text-[10px] font-sans font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low transition-colors"
              >
                Usar semana del gráfico
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50 text-[10px] text-outline font-bold uppercase tracking-widest border-b border-primary/5">
                {workHistoryMode === 'period' ? (
                  <th className="py-4 px-6">Fecha</th>
                ) : null}
                <th className="py-4 px-6">Hora</th>
                <th className="py-4 px-6">Cliente</th>
                <th className="py-4 px-6">Tratamiento / Servicio</th>
                <th className="py-4 px-6 text-right">Monto bruto</th>
                <th className="py-4 px-6 text-right">Desc.</th>
                <th className="py-4 px-6 text-right">Comisión ({staff.commissionPercent}%)</th>
                <th className="py-4 px-6 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {workHistoryAppointments.length === 0 ? (
                <tr>
                  <td
                    colSpan={workHistoryMode === 'period' ? 8 : 7}
                    className="py-8 px-6 text-center text-xs text-outline"
                  >
                    Sin trabajos para {staff.name} en{' '}
                    {workHistoryMode === 'day' ? workDayLabel : 'el periodo seleccionado'}.
                  </td>
                </tr>
              ) : (
                workHistoryAppointments.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-container-low/30 transition-colors">
                    {workHistoryMode === 'period' ? (
                      <td className="py-4 px-6 font-mono text-[10px] text-outline font-bold">
                        {item.date}
                      </td>
                    ) : null}
                    <td className="py-4 px-6 font-mono font-bold text-xs text-primary">
                      {item.time}
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-sans font-bold text-xs text-primary">{item.clientName}</p>
                      <span className="text-[9px] bg-primary/5 text-primary px-1.5 py-0.2 rounded font-semibold uppercase">
                        {item.badge}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs text-on-surface-variant font-medium">
                      {item.service}
                    </td>
                    <td className="py-4 px-6 text-right font-display font-black text-xs text-primary">
                      {item.cost > 0 ? formatServicePrice(item.cost) : 'Por definir'}
                    </td>
                    <td className="py-4 px-6 text-right font-display font-black text-xs text-amber-900">
                      {item.isPaid && item.discount > 0 ? `−${formatServicePrice(item.discount)}` : '—'}
                    </td>
                    <td className="py-4 px-6 text-right font-display font-black text-xs text-secondary">
                      {item.isPaid
                        ? item.cost > 0
                          ? formatServicePrice(item.commission)
                          : 'Por definir'
                        : 'Pendiente'}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          getAppointmentStatusStyles(item.status).badgeClass
                        }`}
                      >
                        {getAppointmentStatusLabel(item.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-surface-container-low/30 font-bold border-t border-primary/10">
                <td
                  colSpan={workHistoryMode === 'period' ? 4 : 3}
                  className="py-4 px-6 text-xs text-primary uppercase"
                >
                  {workHistoryMode === 'day'
                    ? 'Total terminado del día'
                    : 'Total terminado del periodo'}
                </td>
                <td className="py-4 px-6 text-right font-display font-extrabold text-sm text-primary">
                  {totalWorkSales > 0 ? formatServicePrice(totalWorkSales) : 'Por definir'}
                </td>
                <td className="py-4 px-6 text-right font-display font-extrabold text-sm text-amber-900">
                  {workHistoryAppointments.some((item) => item.discount > 0)
                    ? `−${formatServicePrice(
                        workHistoryAppointments.reduce((sum, item) => sum + (item.discount || 0), 0)
                      )}`
                    : '—'}
                </td>
                <td className="py-4 px-6 text-right font-display font-extrabold text-sm text-secondary">
                  {totalWorkCommission > 0
                    ? formatServicePrice(totalWorkCommission)
                    : 'Por definir'}
                </td>
                <td className="py-4 px-6"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <StaffEditProfileModal
        staff={staff}
        isOpen={isEditProfileOpen}
        isSubmitting={isSavingProfile}
        error={editProfileError}
        onClose={handleCloseEditProfile}
        onSave={handleSaveProfile}
        onPhotoUpdated={onStaffUpdated}
      />

      <StaffReportModal
        staff={staff}
        appointments={appointments}
        weekStart={weekStart}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        loggedInAccountant={loggedInAccountant}
        onActivityRecorded={onAccountantActivity}
      />

      <StaffLiquidateModal
        staff={staff}
        appointments={appointments}
        weekStart={weekStart}
        isOpen={isLiquidateModalOpen}
        onClose={() => setIsLiquidateModalOpen(false)}
        onSettled={handleSettlementRecorded}
        loggedInAccountant={loggedInAccountant}
      />

      {isAccountantSession ? (
        <AccountantDiscountsPanel
          title="Todos los descuentos (nómina)"
          subtitle="Incluye manicuristas y recepción. Los de recepción no se liquidan solos: rebájalos de su nómina."
        />
      ) : null}

      {showAccountantBitacora ? (
        <AccountantActivityPanel
          staffId={staff.id}
          staffName={staff.name}
          refreshKey={activityRefreshKey}
        />
      ) : null}
    </div>
  );
}
