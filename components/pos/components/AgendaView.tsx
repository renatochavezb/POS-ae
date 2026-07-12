import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Trash2,
  Lock,
  X,
  CheckCircle2,
  Pencil,
  Send,
} from 'lucide-react';
import { Appointment, DailyStats, Receptionist, ScheduleConfig, Staff, StaffBlockedSlot } from '../types';
import {
  buildCalendarHourSlots,
  buildDayScheduleConfig,
  DEFAULT_SCHEDULE_CONFIG,
  formatAppointmentTimeRange,
  formatDuration,
  getMonday,
  formatSpanishShortDateInTimeZone,
  getTodaySpanishShortDate,
  addDays,
  parseTimeToMinutes,
  isStaffTimeBlocked,
  getDurationOptionsFromConfig,
  resolveScheduleForDate,
  resolveScheduleForDateLabel,
} from '../scheduleUtils';
import posApi from '@/libs/posApi';
import { getAgendaStaffForDate, isStaffActiveForOperations } from '@/libs/posStaffAgenda';
import AppointmentServiceList from '../serviceDisplay';
import { getStaffById } from '../staffColors';
import { formatServicePrice } from '../data';
import AppointmentStatusControls from './AppointmentStatusControls';
import ReceptionistPinModal, { ReceptionistAuthPayload } from './ReceptionistPinModal';
import {
  canCancelAppointment,
  canDeleteAppointment,
  canEditAppointment,
  isAppointmentPaid,
  isAppointmentUnconfirmed,
  normalizeAppointmentStatus,
} from '../appointmentStatus';
import AppointmentEditModal, { AppointmentEditPayload } from './AppointmentEditModal';
import { AppointmentStatus, Service } from '../types';
import SendToCajaModal from './SendToCajaModal';

interface AgendaViewProps {
  appointments: Appointment[];
  staffList: Staff[];
  blockedSlots: StaffBlockedSlot[];
  scheduleConfig?: ScheduleConfig;
  receptionists: Receptionist[];
  defaultReceptionistId?: string | null;
  onOpenNewAppointment: (defaultDay?: string, defaultTime?: string, staffId?: string) => void;
  onSelectStaff: (id: string) => void;
  onDeleteAppointment: (appointmentId: string, auth: ReceptionistAuthPayload) => Promise<void>;
  onCancelAppointment: (appointmentId: string, auth: ReceptionistAuthPayload) => Promise<void>;
  onEditAppointment: (appointmentId: string, payload: AppointmentEditPayload) => Promise<void>;
  onUpdateAppointmentStatus: (appointmentId: string, status: AppointmentStatus) => void;
  onCloseStaffSlot: (slot: Omit<StaffBlockedSlot, 'id'>) => void;
  onRemoveBlockedSlot: (blockedSlotId: string) => void;
  readOnly?: boolean;
  lockedStaffId?: string | null;
  services?: Service[];
  ticketAppointmentIds?: string[];
  onTicketSubmitted?: () => void | Promise<void>;
}

type CloseDraft = {
  date: string;
  time: string;
  staffId: string;
  duration: number;
  reason: string;
};

type WeekDay = {
  name: string;
  date: string;
  fullDate: string;
  rawDate: Date;
};

const generateWeekDays = (monday: Date): WeekDay[] => {
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return Array.from({ length: 7 }, (_, index) => {
    const tempDate = new Date(monday);
    tempDate.setDate(monday.getDate() + index);
    const fullDate = formatSpanishShortDateInTimeZone(tempDate);

    return {
      name: dayNames[index],
      date: String(tempDate.getDate()),
      fullDate,
      rawDate: tempDate
    };
  });
};

const isSameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const HALF_HOUR_HEIGHT = 44;

function getTimelineMetrics(config: ScheduleConfig) {
  const startMinutes = config.startHour * 60;
  const endMinutes = config.endHour * 60;
  const totalMinutes = endMinutes - startMinutes;
  const halfHourSlots = totalMinutes / 30;
  const height = halfHourSlots * HALF_HOUR_HEIGHT;

  return { startMinutes, endMinutes, totalMinutes, halfHourSlots, height };
}

const EMPTY_DAILY_STATS: DailyStats = {
  date: '',
  citas: 0,
  sinConfirmar: 0,
  pagadas: 0,
  canceladas: 0,
};

export default function AgendaView({
  appointments,
  staffList,
  blockedSlots,
  scheduleConfig = DEFAULT_SCHEDULE_CONFIG,
  receptionists,
  defaultReceptionistId = null,
  onOpenNewAppointment,
  onSelectStaff,
  onDeleteAppointment,
  onCancelAppointment,
  onEditAppointment,
  onUpdateAppointmentStatus,
  onCloseStaffSlot,
  onRemoveBlockedSlot,
  readOnly = false,
  lockedStaffId = null,
  services = [],
  ticketAppointmentIds = [],
  onTicketSubmitted,
}: AgendaViewProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [closeMode, setCloseMode] = useState(false);
  const [closeDraft, setCloseDraft] = useState<CloseDraft | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats>(EMPTY_DAILY_STATS);
  const [pendingAuthAction, setPendingAuthAction] = useState<{
    type: 'cancel' | 'delete';
    appointment: Appointment;
  } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [sendToCajaAppointment, setSendToCajaAppointment] = useState<Appointment | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [isStatsBarFloating, setIsStatsBarFloating] = useState(false);
  const statsBarSentinelRef = useRef<HTMLDivElement>(null);

  const selectedDaySchedule = useMemo(
    () => resolveScheduleForDate(selectedDate, scheduleConfig),
    [selectedDate, scheduleConfig]
  );

  const dayScheduleConfig = useMemo(
    () => buildDayScheduleConfig(selectedDate, scheduleConfig),
    [selectedDate, scheduleConfig]
  );

  const isSalonClosed = selectedDaySchedule.closed;

  const timeline = useMemo(
    () => getTimelineMetrics(dayScheduleConfig),
    [dayScheduleConfig]
  );
  const hours = useMemo(
    () => buildCalendarHourSlots(dayScheduleConfig),
    [dayScheduleConfig]
  );

  const days = useMemo(() => generateWeekDays(currentWeekStart), [currentWeekStart]);
  const selectedDayLabel = formatSpanishShortDateInTimeZone(selectedDate);

  const todayAppointments = useMemo(() => {
    let items = appointments.filter((app) => app.date === selectedDayLabel);
    if (lockedStaffId) {
      items = items.filter((app) => app.staffId === lockedStaffId);
    }
    return items;
  }, [appointments, selectedDayLabel, lockedStaffId]);

  const todayBlockedSlots = useMemo(
    () => blockedSlots.filter((slot) => slot.date === selectedDayLabel),
    [blockedSlots, selectedDayLabel]
  );

  const agendaStaffList = useMemo(() => {
    const base = getAgendaStaffForDate(staffList, selectedDayLabel);
    if (!lockedStaffId) return base;
    return base.filter((staff) => staff.id === lockedStaffId);
  }, [staffList, selectedDayLabel, lockedStaffId]);

  useEffect(() => {
    let cancelled = false;

    if (lockedStaffId) {
      setDailyStats({
        date: selectedDayLabel,
        citas: todayAppointments.length,
        sinConfirmar: todayAppointments.filter((app) =>
          isAppointmentUnconfirmed(app.status)
        ).length,
        pagadas: todayAppointments.filter((app) => isAppointmentPaid(app.status)).length,
        canceladas: todayAppointments.filter(
          (app) => normalizeAppointmentStatus(app.status) === 'cancelled'
        ).length,
      });
      return () => {
        cancelled = true;
      };
    }

    posApi
      .getAppointmentDailyStats(selectedDayLabel)
      .then((stats) => {
        if (!cancelled) setDailyStats(stats);
      })
      .catch(() => {
        if (!cancelled) {
          setDailyStats({
            date: selectedDayLabel,
            citas: todayAppointments.length,
            sinConfirmar: todayAppointments.filter((app) =>
              isAppointmentUnconfirmed(app.status)
            ).length,
            pagadas: todayAppointments.filter((app) => isAppointmentPaid(app.status)).length,
            canceladas: todayAppointments.filter(
              (app) => normalizeAppointmentStatus(app.status) === 'cancelled'
            ).length,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDayLabel, appointments, todayAppointments, lockedStaffId]);

  useEffect(() => {
    const sentinel = statsBarSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsStatsBarFloating(!entry.isIntersecting),
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const getIsToday = (dayFullDate: string) => dayFullDate === getTodaySpanishShortDate();

  const getIsSelectedDay = (dayFullDate: string) => dayFullDate === selectedDayLabel;

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentWeekStart(getMonday(today));
    setSelectedDate(today);
  };

  const handlePrevWeek = () => {
    const prevMonday = addDays(currentWeekStart, -7);
    setCurrentWeekStart(prevMonday);
    setSelectedDate(prevMonday);
  };

  const handleNextWeek = () => {
    const nextMonday = addDays(currentWeekStart, 7);
    setCurrentWeekStart(nextMonday);
    setSelectedDate(nextMonday);
  };

  const formatSelectedDayHeading = (date: Date) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return `${weekdays[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const handleDeleteAppointment = (appointment: Appointment) => {
    if (!canDeleteAppointment(appointment.status)) {
      window.alert('No se puede eliminar una cita confirmada o pagada.');
      return;
    }

    setAuthError(null);
    setPendingAuthAction({ type: 'delete', appointment });
  };

  const handleCancelAppointment = (appointment: Appointment) => {
    if (!canCancelAppointment(appointment.status)) {
      window.alert('No se puede cancelar una cita confirmada o pagada.');
      return;
    }

    setAuthError(null);
    setPendingAuthAction({ type: 'cancel', appointment });
  };

  const handleConfirmEdit = async (payload: AppointmentEditPayload) => {
    if (!editingAppointment) return;

    setIsEditSubmitting(true);
    setEditError(null);

    try {
      await onEditAppointment(editingAppointment.id, payload);
      setSelectedAppointment((prev) =>
        prev?.id === editingAppointment.id
          ? {
              ...prev,
              serviceName: payload.serviceName,
              serviceSubtitle: payload.serviceSubtitle,
              date: payload.date,
              time: payload.time,
              duration: payload.duration,
              cost: payload.cost,
            }
          : prev
      );
      setEditingAppointment(null);
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : 'No se pudo guardar los cambios.'
      );
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleConfirmAuthAction = async (auth: ReceptionistAuthPayload) => {
    if (!pendingAuthAction) return;

    setIsAuthSubmitting(true);
    setAuthError(null);

    try {
      if (pendingAuthAction.type === 'delete') {
        await onDeleteAppointment(pendingAuthAction.appointment.id, auth);
        if (selectedAppointment?.id === pendingAuthAction.appointment.id) {
          setSelectedAppointment(null);
        }
      } else {
        await onCancelAppointment(pendingAuthAction.appointment.id, auth);
        if (selectedAppointment?.id === pendingAuthAction.appointment.id) {
          setSelectedAppointment({
            ...pendingAuthAction.appointment,
            status: 'cancelled',
          });
        }
      }

      setPendingAuthAction(null);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'No se pudo autorizar la acción.'
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const gridTemplateColumns = `48px repeat(${agendaStaffList.length}, minmax(0, 1fr))`;

  const getTimelineLayout = (time: string, duration: number) => {
    const startMinutes = parseTimeToMinutes(time);
    if (startMinutes < timeline.startMinutes || startMinutes >= timeline.endMinutes) {
      return null;
    }

    const top = ((startMinutes - timeline.startMinutes) / 30) * HALF_HOUR_HEIGHT;
    const height = Math.max(
      HALF_HOUR_HEIGHT - 4,
      (duration / 30) * HALF_HOUR_HEIGHT - 4
    );

    return { top, height, duration };
  };

  const getAppointmentLayout = (appointment: Appointment) =>
    getTimelineLayout(appointment.time, appointment.duration ?? 60);

  const formatSlotTime = (slotIndex: number) => {
    const totalMinutes = timeline.startMinutes + slotIndex * 30;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const handleSlotClick = (slotTime: string, staffId: string) => {
    if (readOnly) return;

    if (isSalonClosed) {
      return;
    }

    const staffMember = staffList.find((member) => member.id === staffId);
    if (!isStaffActiveForOperations(staffMember)) {
      return;
    }

    if (closeMode) {
      setCloseDraft({
        date: selectedDayLabel,
        time: slotTime,
        staffId,
        duration: 30,
        reason: scheduleConfig.closeReasons[0] || 'Descanso'
      });
      return;
    }

    if (isStaffTimeBlocked(blockedSlots, selectedDayLabel, staffId, slotTime, 30)) {
      return;
    }

    onOpenNewAppointment(selectedDayLabel, slotTime, staffId);
  };

  const handleConfirmCloseSlot = () => {
    if (!closeDraft) return;

    onCloseStaffSlot({
      date: closeDraft.date,
      staffId: closeDraft.staffId,
      time: closeDraft.time,
      duration: closeDraft.duration,
      reason: closeDraft.reason
    });
    setCloseDraft(null);
    setCloseMode(false);
  };

  const handleRemoveBlockedSlot = (slot: StaffBlockedSlot) => {
    const staffName = staffList.find((member) => member.id === slot.staffId)?.name ?? slot.staffId;
    const confirmed = window.confirm(
      `¿Abrir el horario de ${staffName} (${slot.time}, ${formatDuration(slot.duration)})?`
    );
    if (confirmed) {
      onRemoveBlockedSlot(slot.id);
    }
  };

  return (
    <div className="space-y-5 md:space-y-8 animate-fade-in p-1 md:p-6 max-w-full mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-secondary font-sans text-xs font-bold tracking-widest uppercase">Agenda por especialista</span>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-primary mt-1">
            {lockedStaffId ? 'Mi Agenda' : 'Calendario del Día'}
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            {readOnly
              ? lockedStaffId
                ? 'Vista de consulta de tu agenda. No puedes agendar, editar ni cancelar citas.'
                : 'Vista de consulta. No puedes modificar citas.'
              : closeMode
              ? 'Haz clic en un horario para cerrarlo. No se podrán agendar citas en ese bloque.'
              : 'Cada columna es una manicurista. En móvil verás la lista del día; en pantalla grande, el calendario por columnas.'}
          </p>
        </div>
        {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isSalonClosed}
            onClick={() => {
              if (isSalonClosed) return;
              setCloseMode((prev) => !prev);
              setCloseDraft(null);
            }}
            className={`hidden lg:flex items-center gap-2 px-4 py-2 rounded-lg font-sans text-xs font-bold uppercase tracking-wider transition-all border ${
              isSalonClosed
                ? 'border-primary/10 text-outline opacity-50 cursor-not-allowed'
                : closeMode
                ? 'bg-primary text-on-primary border-primary shadow-sm'
                : 'border-primary/10 text-primary hover:bg-surface-container-low'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>{closeMode ? 'Cerrar: activo' : 'Cerrar horario'}</span>
          </button>
          <button
            onClick={() => {
              if (isSalonClosed) {
                window.alert('El salón está cerrado este día. No se pueden agendar citas.');
                return;
              }
              onOpenNewAppointment(selectedDayLabel);
            }}
            disabled={isSalonClosed}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-sans text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${
              isSalonClosed
                ? 'bg-surface-container-low text-outline cursor-not-allowed opacity-60'
                : 'bg-primary text-on-primary hover:bg-primary-container'
            }`}
          >
            <Plus className="w-4 h-4 text-secondary" />
            <span>Reservar Cita</span>
          </button>
        </div>
        )}
      </div>

      <div ref={statsBarSentinelRef} className="h-px" aria-hidden="true" />

      <div className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow flex flex-col">
          <div
            className={`sticky top-3 z-30 px-3 md:px-4 pt-3 pb-2 transition-all duration-300 ${
              isStatsBarFloating ? 'md:px-6' : ''
            }`}
          >
            <div
              className={`rounded-2xl border bg-surface/92 backdrop-blur-xl px-4 py-3 md:px-5 md:py-4 transition-all duration-300 ${
                isStatsBarFloating
                  ? 'border-primary/15 shadow-[0_12px_40px_rgba(0,38,27,0.14)] ring-1 ring-primary/5'
                  : 'border-primary/10 shadow-[0_4px_20px_rgba(0,38,27,0.06)]'
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Calendar className="w-5 h-5 text-secondary shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-display font-bold text-primary text-base truncate">
                      {formatSelectedDayHeading(selectedDate)}
                    </h3>
                    <p className={`text-[10px] uppercase tracking-widest mt-0.5 ${
                      isSalonClosed ? 'text-red-600 font-bold' : 'text-outline'
                    }`}>
                      Vista operativa · {selectedDaySchedule.hoursLabel}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="px-3 py-2 rounded-xl border border-primary/10 bg-primary/5 text-center min-w-[76px]">
                      <p className="text-lg font-display font-extrabold text-primary leading-none">
                        {dailyStats.citas}
                      </p>
                      <p className="text-[9px] text-outline font-sans uppercase tracking-wider mt-1">Citas</p>
                    </div>
                    <div className="px-3 py-2 rounded-xl border border-sky-200 bg-sky-50 text-center min-w-[76px]">
                      <p className="text-lg font-display font-extrabold text-sky-700 leading-none">
                        {dailyStats.sinConfirmar}
                      </p>
                      <p className="text-[9px] text-outline font-sans uppercase tracking-wider mt-1">Sin confirmar</p>
                    </div>
                    <div className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-center min-w-[76px]">
                      <p className="text-lg font-display font-extrabold text-emerald-700 leading-none">
                        {dailyStats.pagadas}
                      </p>
                      <p className="text-[9px] text-outline font-sans uppercase tracking-wider mt-1">Pagadas</p>
                    </div>
                    <div className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-center min-w-[76px]">
                      <p className="text-lg font-display font-extrabold text-red-700 leading-none">
                        {dailyStats.canceladas}
                      </p>
                      <p className="text-[9px] text-outline font-sans uppercase tracking-wider mt-1">Canceladas</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-xl border border-primary/10 bg-surface px-1 py-1">
                    <button
                      onClick={handlePrevWeek}
                      title="Semana anterior"
                      className="p-1.5 rounded-lg hover:bg-surface-container-low text-primary transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleGoToToday}
                      className="px-3 py-1 text-xs font-sans font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer"
                    >
                      Hoy
                    </button>
                    <button
                      onClick={handleNextWeek}
                      title="Semana siguiente"
                      className="p-1.5 rounded-lg hover:bg-surface-container-low text-primary transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 md:px-6 pb-4 border-b border-primary/5 bg-surface-container-low/30 space-y-3">
            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => {
                const isToday = getIsToday(day.fullDate);
                const isSelected = getIsSelectedDay(day.fullDate);
                const dayCount = appointments.filter((app) => app.date === day.fullDate).length;
                const daySchedule = resolveScheduleForDateLabel(day.fullDate, scheduleConfig);

                return (
                  <button
                    key={day.fullDate}
                    type="button"
                    onClick={() => setSelectedDate(new Date(day.rawDate))}
                    className={`rounded-xl border px-2 py-2 text-center transition-all ${
                      isSelected
                        ? 'border-primary bg-primary text-on-primary shadow-sm'
                        : isToday
                        ? 'border-secondary/40 bg-secondary/10 text-primary'
                        : daySchedule.closed
                        ? 'border-red-200 bg-red-50/80 text-primary'
                        : 'border-primary/10 hover:bg-surface-container-low text-primary'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase block opacity-80">{day.name}</span>
                    <span className="text-sm font-display font-extrabold block">{day.date}</span>
                    {daySchedule.closed ? (
                      <span className={`text-[9px] font-bold mt-1 block ${
                        isSelected ? 'text-on-primary/80' : 'text-red-600'
                      }`}>
                        Cerrado
                      </span>
                    ) : dayCount > 0 ? (
                      <span className={`text-[9px] font-bold mt-1 block ${isSelected ? 'text-on-primary/80' : 'text-secondary'}`}>
                        {dayCount} cita{dayCount !== 1 ? 's' : ''}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {isSalonClosed ? (
              <p className="text-[11px] text-red-700 font-medium leading-relaxed px-1">
                Salón cerrado este día. Las citas existentes se muestran en modo consulta; no se pueden
                agendar ni bloquear horarios nuevos.
              </p>
            ) : todayAppointments.length === 0 ? (
              <p className="text-[11px] text-outline leading-relaxed px-1">
                {readOnly
                  ? 'No tienes citas para este día.'
                  : 'No hay citas para este día. Usa "Reservar Cita" para agendar.'}
              </p>
            ) : null}
          </div>

          <div className="lg:hidden px-4 md:px-6 pb-4 space-y-3">
            <p className="text-[10px] text-outline font-bold uppercase tracking-wider">
              Citas del día · vista móvil
            </p>
            {todayAppointments.length === 0 ? (
              <p className="text-xs text-outline rounded-xl border border-primary/10 bg-surface px-4 py-6 text-center">
                No hay citas para este día.
              </p>
            ) : (
              <div className="space-y-2">
                {[...todayAppointments]
                  .sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time))
                  .map((appointment) => {
                    const appointmentStaff =
                      getStaffById(staffList, appointment.staffId) ?? agendaStaffList[0];
                    const duration = appointment.duration;

                    return (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => setSelectedAppointment(appointment)}
                        className="w-full text-left rounded-xl border p-3 shadow-sm transition-transform active:scale-[0.99]"
                        style={{
                          backgroundColor: appointmentStaff?.colorLight ?? '#f6f3f2',
                          borderColor: appointmentStaff?.color ?? '#00261b',
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-primary truncate">
                              {appointment.clientName}
                            </p>
                            <p className="text-[11px] text-outline mt-0.5">
                              {appointment.staffName}
                            </p>
                          </div>
                          <span className="text-xs font-mono font-bold text-primary shrink-0">
                            {formatAppointmentTimeRange(appointment.time, duration)}
                          </span>
                        </div>
                        <div className="mt-2">
                          <AppointmentServiceList
                            serviceName={appointment.serviceName}
                            lineClassName="text-[11px] text-outline line-clamp-2"
                          />
                        </div>
                        <div className="mt-2 pt-2 border-t border-black/10">
                          <AppointmentStatusControls
                            compact
                            readOnly={readOnly}
                            status={appointment.status}
                            accentColor={appointmentStaff?.color}
                            onChange={(nextStatus) =>
                              onUpdateAppointmentStatus(appointment.id, nextStatus)
                            }
                          />
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <div className="w-full min-w-[860px]">
              <div
                className="border-b border-primary/5 bg-surface-container-low/20"
                style={{ display: 'grid', gridTemplateColumns }}
              >
                <div className="px-1 py-2 border-r border-primary/5 flex items-center justify-center text-[9px] text-outline font-bold uppercase tracking-widest">
                  Hora
                </div>
                {agendaStaffList.map((staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => onSelectStaff(staff.id)}
                    title={`${staff.name} — ${staff.role}`}
                    className="px-1 py-2 border-r border-primary/5 text-center hover:bg-surface-container-low/40 transition-colors min-w-0"
                    style={{ borderTop: `3px solid ${staff.color}` }}
                  >
                    <div
                      className="w-7 h-7 rounded-full mx-auto flex items-center justify-center text-[9px] font-bold"
                      style={{ backgroundColor: staff.colorLight, color: staff.color }}
                    >
                      {staff.id}
                    </div>
                    <p className="text-[10px] font-bold text-primary mt-1 truncate px-0.5">{staff.name}</p>
                  </button>
                ))}
              </div>

              <div className="max-h-[calc(100dvh-280px)] min-h-[420px] lg:min-h-[520px] overflow-y-auto relative">
                {isSalonClosed ? (
                  <div
                    className="absolute inset-0 z-30 pointer-events-none"
                    style={{
                      background:
                        'repeating-linear-gradient(135deg, rgba(239,68,68,0.04) 0, rgba(239,68,68,0.04) 12px, rgba(254,242,242,0.5) 12px, rgba(254,242,242,0.5) 24px)',
                    }}
                  />
                ) : null}
                {isSalonClosed ? (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                    <div className="px-4 py-2 rounded-xl border border-red-200 bg-red-50/95 shadow-sm flex items-center gap-2">
                      <Lock className="w-4 h-4 text-red-700" />
                      <span className="text-xs font-bold uppercase tracking-wider text-red-800">
                        Salón cerrado
                      </span>
                    </div>
                  </div>
                ) : null}
                <div
                  className="relative"
                  style={{
                    display: 'grid',
                    gridTemplateColumns,
                    height: timeline.height
                  }}
                >
                  <div className="relative border-r border-primary/5 bg-surface-container-lowest">
                    {hours.map((hour, index) => (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 -translate-y-1/2 text-center text-[10px] font-mono font-bold text-primary"
                        style={{
                          top: Math.min(index * HALF_HOUR_HEIGHT * 2, timeline.height - 8)
                        }}
                      >
                        {hour}
                      </div>
                    ))}
                  </div>

                  {agendaStaffList.map((staff) => {
                    const isInactiveColumn = !isStaffActiveForOperations(staff);
                    const staffAppointments = appointments.filter(
                      (appointment) =>
                        appointment.date === selectedDayLabel &&
                        appointment.staffId === staff.id
                    );
                    const staffBlockedSlots = blockedSlots.filter(
                      (slot) => slot.date === selectedDayLabel && slot.staffId === staff.id
                    );
                    const isTodaySelected = isSameCalendarDay(selectedDate, new Date());

                    return (
                      <div
                        key={staff.id}
                        className={`relative border-r border-primary/5 min-w-0 ${
                          isTodaySelected ? 'bg-primary/[0.015]' : ''
                        } ${isInactiveColumn ? 'opacity-80' : ''}`}
                      >
                        {Array.from({ length: timeline.halfHourSlots }).map((_, slotIndex) => {
                          const slotTime = formatSlotTime(slotIndex);
                          const isHourBoundary = slotIndex % 2 === 0;
                          const isBlocked = isStaffTimeBlocked(
                            blockedSlots,
                            selectedDayLabel,
                            staff.id,
                            slotTime,
                            30
                          );

                          return (
                            <button
                              key={`${staff.id}-${slotTime}`}
                              type="button"
                              onClick={() => handleSlotClick(slotTime, staff.id)}
                              className={`absolute left-0 right-0 border-primary/5 transition-colors group ${
                                isHourBoundary ? 'border-t' : 'border-t border-dashed opacity-70'
                              } ${
                                isSalonClosed || isInactiveColumn || readOnly
                                  ? 'cursor-default opacity-40'
                                  : closeMode
                                  ? 'hover:bg-amber-500/10 cursor-crosshair'
                                  : isBlocked
                                  ? 'cursor-not-allowed'
                                  : 'hover:bg-surface-container-low/40 cursor-pointer'
                              }`}
                              style={{
                                top: slotIndex * HALF_HOUR_HEIGHT,
                                height: HALF_HOUR_HEIGHT
                              }}
                              title={
                                readOnly
                                  ? 'Vista de consulta'
                                  : isSalonClosed
                                  ? 'Salón cerrado este día'
                                  : isInactiveColumn
                                  ? `Historial de ${staff.name} (sin reservas nuevas)`
                                  : closeMode
                                  ? `Cerrar horario de ${staff.name} a las ${slotTime}`
                                  : isBlocked
                                  ? `Horario cerrado`
                                  : `Reservar ${staff.name} a las ${slotTime}`
                              }
                            >
                              {!isBlocked && !closeMode && !isInactiveColumn && !isSalonClosed && !readOnly && (
                                <span
                                  className="opacity-0 group-hover:opacity-100 text-[9px] px-2 py-1 rounded font-bold uppercase tracking-wider shadow-sm inline-flex items-center gap-1 border"
                                  style={{
                                    backgroundColor: staff.colorLight,
                                    borderColor: staff.color,
                                    color: staff.color
                                  }}
                                >
                                  <Plus className="w-3 h-3" /> {slotTime}
                                </span>
                              )}
                              {closeMode && !isInactiveColumn && !isSalonClosed && (
                                <span className="opacity-0 group-hover:opacity-100 text-[9px] px-2 py-1 rounded font-bold uppercase tracking-wider shadow-sm inline-flex items-center gap-1 border border-amber-300 bg-amber-50 text-amber-900">
                                  <Lock className="w-3 h-3" /> Cerrar {slotTime}
                                </span>
                              )}
                            </button>
                          );
                        })}

                        {staffBlockedSlots.map((blockedSlot) => {
                          const layout = getTimelineLayout(blockedSlot.time, blockedSlot.duration);
                          if (!layout) return null;

                          return (
                            <div
                              key={blockedSlot.id}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute left-1 right-1 rounded-xl border border-dashed border-outline/50 px-2 py-1.5 z-20 group/blocked"
                              style={{
                                top: layout.top + 2,
                                height: layout.height,
                                background:
                                  'repeating-linear-gradient(135deg, #eceae4 0, #eceae4 8px, #f7f5ef 8px, #f7f5ef 16px)'
                              }}
                            >
                              <button
                                type="button"
                                disabled={readOnly}
                                onClick={() => !readOnly && handleRemoveBlockedSlot(blockedSlot)}
                                title="Abrir horario"
                                className={`absolute top-1 right-1 p-1 rounded-md transition-all ${
                                  readOnly
                                    ? 'hidden'
                                    : 'opacity-50 hover:opacity-100 hover:bg-black/10'
                                }`}
                                aria-label="Abrir horario"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-outline pr-4">
                                Cerrado
                              </p>
                              <p className="text-[8px] text-outline mt-0.5 line-clamp-1">
                                {blockedSlot.reason || 'No disponible'}
                              </p>
                              <p className="text-[8px] font-mono font-bold text-outline mt-1">
                                {formatAppointmentTimeRange(blockedSlot.time, layout.duration)}
                              </p>
                            </div>
                          );
                        })}

                        {staffAppointments.map((appointment) => {
                          const layout = getAppointmentLayout(appointment);
                          if (!layout) return null;

                          const appointmentStaff = getStaffById(staffList, appointment.staffId) ?? staff;
                          const canRemove = !readOnly && canDeleteAppointment(appointment.status);

                          return (
                            <div
                              key={appointment.id}
                              onClick={() => setSelectedAppointment(appointment)}
                              className="absolute left-1 right-1 rounded-xl p-2 flex flex-col justify-between text-left transition-all hover:-translate-y-0.5 border shadow-sm group/appointment z-10 cursor-pointer"
                              style={{
                                top: layout.top + 2,
                                height: layout.height,
                                backgroundColor: appointmentStaff.colorLight,
                                borderColor: appointmentStaff.color,
                                color: '#1b1c1c'
                              }}
                            >
                              {canRemove && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAppointment(appointment);
                                  }}
                                  title="Eliminar cita"
                                  className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-40 hover:opacity-100 hover:bg-black/10 transition-all"
                                  aria-label="Eliminar cita"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                              <div className="pr-5 min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider truncate">
                                  {appointment.clientName}
                                </p>
                                <AppointmentServiceList
                                  serviceName={appointment.serviceName}
                                  lineClassName="text-[9px] opacity-80 font-sans font-medium line-clamp-1"
                                />
                              </div>
                              <div className="mt-1.5 pt-1 border-t border-black/10">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[9px] font-mono font-bold leading-tight">
                                    {formatAppointmentTimeRange(appointment.time, layout.duration)}
                                  </span>
                                  <span className="text-[8px] font-bold opacity-80 shrink-0">
                                    {formatDuration(layout.duration)}
                                  </span>
                                </div>
                                <div className="mt-1">
                                  <AppointmentStatusControls
                                    compact
                                    readOnly={readOnly}
                                    status={appointment.status}
                                    accentColor={appointmentStaff.color}
                                    onChange={(nextStatus) =>
                                      onUpdateAppointmentStatus(appointment.id, nextStatus)
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

      {closeDraft && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface-container-lowest max-w-md w-full rounded-2xl border border-primary/5 luxury-shadow p-6 relative">
            <button
              type="button"
              onClick={() => setCloseDraft(null)}
              className="absolute top-4 right-4 text-outline hover:text-primary transition-colors"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-secondary font-sans text-[10px] font-extrabold uppercase tracking-widest block mb-1">
              Bloquear horario
            </span>
            <h3 className="font-display text-xl font-bold text-primary mb-4">
              {staffList.find((member) => member.id === closeDraft.staffId)?.name ?? closeDraft.staffId}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">Fecha</p>
                  <p className="font-bold text-primary">{closeDraft.date}</p>
                </div>
                <div>
                  <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">Inicio</p>
                  <p className="font-bold text-primary">{closeDraft.time}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Duración del cierre</label>
                <select
                  value={closeDraft.duration}
                  onChange={(e) =>
                    setCloseDraft((prev) =>
                      prev ? { ...prev, duration: Number(e.target.value) } : prev
                    )
                  }
                  className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                >
                  {getDurationOptionsFromConfig(scheduleConfig).map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {formatDuration(minutes)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Motivo</label>
                <select
                  value={closeDraft.reason}
                  onChange={(e) =>
                    setCloseDraft((prev) =>
                      prev ? { ...prev, reason: e.target.value } : prev
                    )
                  }
                  className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                >
                  {scheduleConfig.closeReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-primary/5">
                <button
                  type="button"
                  onClick={() => setCloseDraft(null)}
                  className="px-4 py-2 border border-primary/10 text-outline hover:text-primary rounded-lg text-xs font-sans font-bold uppercase tracking-wider transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCloseSlot}
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-sans text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Cerrar horario
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedAppointment && (() => {
        const detailStaff = getStaffById(staffList, selectedAppointment.staffId) ?? staffList[0];
        const duration = selectedAppointment.duration;

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div
              className="bg-surface-container-lowest max-w-md w-full rounded-2xl border luxury-shadow overflow-hidden relative"
              style={{ borderColor: `${detailStaff?.color ?? '#00261b'}40` }}
            >
              <div
                className="h-1.5 w-full"
                style={{ backgroundColor: detailStaff?.color ?? '#00261b' }}
              />

              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="absolute top-4 right-4 text-outline hover:text-primary transition-colors z-10"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-6 space-y-5">
                <div>
                  <span className="text-secondary font-sans text-[10px] font-extrabold uppercase tracking-widest block mb-1">
                    Detalle de cita
                  </span>
                  <h3 className="font-display text-xl font-bold text-primary pr-8">
                    {selectedAppointment.clientName}
                  </h3>
                  <p className="text-[10px] text-outline font-mono mt-0.5">
                    ID cita: {selectedAppointment.id} · Cliente: {selectedAppointment.clientId}
                  </p>
                </div>

                <AppointmentStatusControls
                  readOnly={readOnly}
                  status={selectedAppointment.status}
                  onChange={(nextStatus) => {
                    onUpdateAppointmentStatus(selectedAppointment.id, nextStatus);
                    setSelectedAppointment({
                      ...selectedAppointment,
                      status: nextStatus,
                    });
                  }}
                />

                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-surface-container-low/50 border border-primary/5">
                    <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">Servicio</p>
                    <AppointmentServiceList
                      serviceName={selectedAppointment.serviceName}
                      lineClassName="text-sm font-bold text-primary"
                    />
                    {selectedAppointment.serviceSubtitle && (
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {selectedAppointment.serviceSubtitle}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-surface-container-low/50 border border-primary/5">
                      <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">Fecha</p>
                      <p className="text-xs font-bold text-primary">{selectedAppointment.date}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container-low/50 border border-primary/5">
                      <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">Horario</p>
                      <p className="text-xs font-mono font-bold text-primary">
                        {formatAppointmentTimeRange(selectedAppointment.time, duration)}
                      </p>
                      <p className="text-[10px] text-outline mt-0.5">{formatDuration(duration)}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-container-low/50 border border-primary/5">
                    <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-2">Especialista</p>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: detailStaff?.color }}
                      />
                      <div>
                        <p className="text-xs font-bold text-primary">{selectedAppointment.staffName}</p>
                        <p className="text-[10px] text-outline">{detailStaff?.role}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-container-low/50 border border-primary/5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">Inversión</p>
                      <p className="text-sm font-display font-extrabold text-primary">
                        {formatServicePrice(selectedAppointment.cost)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">Iniciales</p>
                      <p className="text-xs font-mono font-bold text-primary">{selectedAppointment.staffInitials}</p>
                    </div>
                  </div>
                </div>

                {!readOnly && (
                <div className="pt-2 flex items-center justify-between gap-3 border-t border-primary/5">
                  <div className="flex items-center gap-2">
                    {canCancelAppointment(selectedAppointment.status) && (
                      <button
                        type="button"
                        onClick={() => handleCancelAppointment(selectedAppointment)}
                        className="px-3 py-2 text-amber-800 hover:bg-amber-50 rounded-lg text-xs font-sans font-bold uppercase tracking-wider transition-colors"
                      >
                        Cancelar cita
                      </button>
                    )}
                    {canDeleteAppointment(selectedAppointment.status) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAppointment(selectedAppointment)}
                        className="px-3 py-2 text-red-700 hover:bg-red-50 rounded-lg text-xs font-sans font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canEditAppointment(selectedAppointment.status) && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditError(null);
                          setEditingAppointment(selectedAppointment);
                        }}
                        className="px-4 py-2 bg-primary text-on-primary hover:bg-primary-container rounded-lg text-xs font-sans font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
                      >
                        <Pencil className="w-4 h-4" />
                        Editar
                      </button>
                    )}
                  </div>
                </div>
                )}
                {readOnly && services.length > 0 && selectedAppointment.status !== 'cancelled' && (
                  <div className="pt-2 border-t border-primary/5">
                    {ticketAppointmentIds.includes(selectedAppointment.id) ? (
                      <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        Ficha enviada a caja. La recepción la cobrará.
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSendToCajaAppointment(selectedAppointment)}
                        className="w-full py-3 rounded-xl bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-colors inline-flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        Enviar a caja
                      </button>
                    )}
                  </div>
                )}
                <div className={`${readOnly ? 'pt-2 border-t border-primary/5' : ''} flex justify-end`}>
                  <button
                    type="button"
                    onClick={() => setSelectedAppointment(null)}
                    className="px-4 py-2 border border-primary/10 text-outline hover:text-primary rounded-lg text-xs font-sans font-bold uppercase tracking-wider transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {sendToCajaAppointment && (
        <SendToCajaModal
          appointment={sendToCajaAppointment}
          services={services}
          staffName={sendToCajaAppointment.staffName}
          onClose={() => setSendToCajaAppointment(null)}
          onSubmitted={async () => {
            await onTicketSubmitted?.();
            setSelectedAppointment(null);
          }}
        />
      )}

      {editingAppointment && (
        <AppointmentEditModal
          appointment={editingAppointment}
          scheduleConfig={scheduleConfig}
          isSubmitting={isEditSubmitting}
          error={editError}
          onConfirm={handleConfirmEdit}
          onClose={() => {
            if (!isEditSubmitting) {
              setEditingAppointment(null);
              setEditError(null);
            }
          }}
        />
      )}

      {pendingAuthAction && (
        <ReceptionistPinModal
          title={
            pendingAuthAction.type === 'delete'
              ? 'Eliminar cita'
              : 'Cancelar cita'
          }
          description={
            pendingAuthAction.type === 'delete'
              ? `${pendingAuthAction.appointment.clientName} · ${pendingAuthAction.appointment.time}. Se borrará por completo.`
              : `${pendingAuthAction.appointment.clientName} · ${pendingAuthAction.appointment.time}. Quedará como cancelada.`
          }
          confirmLabel={
            pendingAuthAction.type === 'delete' ? 'Eliminar' : 'Cancelar cita'
          }
          receptionists={receptionists}
          defaultReceptionistId={defaultReceptionistId}
          isSubmitting={isAuthSubmitting}
          error={authError}
          onConfirm={handleConfirmAuthAction}
          onClose={() => {
            if (isAuthSubmitting) return;
            setPendingAuthAction(null);
            setAuthError(null);
          }}
        />
      )}
    </div>
  );
}
