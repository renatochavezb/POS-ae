import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Ban,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  Staff,
  Client,
  Appointment,
  AppointmentStatus,
  PosCashTicket,
  PosPayment,
  Service,
} from '../types';
import {
  getPreviousAppointmentStatus,
  normalizeAppointmentStatus,
} from '../appointmentStatus';
import {
  addDays,
  buildWeekDayEntries,
  formatWeekRangeLabel,
  getStudioWeekStart,
  isCurrentWeek,
} from '../scheduleUtils';
import { compareSpanishShortDates } from '@/libs/spanishDateUtils';
import { getBookableStaff } from '@/libs/posStaffAgenda';
import posApi from '@/libs/posApi';
import { formatServicePrice } from '../data';
import WeeklyCompletedAppointmentsCard from './WeeklyCompletedAppointmentsCard';
import WeeklySalesCard from './WeeklySalesCard';
import WeeklyCutsCard from './WeeklyCutsCard';
import WeeklyWeekComparisonCard from './WeeklyWeekComparisonCard';
import CabinOccupancyCard from './CabinOccupancyCard';
import SendToCajaModal from './SendToCajaModal';
import AdminAppointmentConfirmModal, {
  AdminAppointmentAction,
} from './AdminAppointmentConfirmModal';

type BoardCard = {
  id: string;
  appointmentId: string;
  date: string;
  time: string;
  clientName: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  amount?: number;
};

interface DashboardViewProps {
  staffList: Staff[];
  clients: Client[];
  appointments: Appointment[];
  onOpenNewAppointment: () => void;
  onOpenNewClient: () => void;
  onSelectClient: (id: string) => void;
  onSelectStaff: (id: string) => void;
  services: Service[];
  canManageStatuses?: boolean;
  onUpdateAppointmentStatus: (
    appointmentId: string,
    status: AppointmentStatus
  ) => Promise<void>;
  onAdminRevertAppointmentStatus?: (appointmentId: string) => Promise<void>;
  onAdminCancelAppointment?: (appointmentId: string) => Promise<void>;
  onAdminDeleteAppointment?: (appointmentId: string) => Promise<void>;
  onOpenCaja: () => void;
}

function matchesStaffFilter(staffId: string, selectedStaffIds: string[]) {
  return selectedStaffIds.length === 0 || selectedStaffIds.includes(staffId);
}

function sortBoardCards(a: BoardCard, b: BoardCard) {
  const byDate = compareSpanishShortDates(a.date, b.date);
  if (byDate !== 0) return byDate;
  return a.time.localeCompare(b.time);
}

export default function DashboardView({
  staffList,
  appointments,
  onOpenNewAppointment,
  onOpenNewClient,
  services,
  canManageStatuses = false,
  onUpdateAppointmentStatus,
  onAdminRevertAppointmentStatus,
  onAdminCancelAppointment,
  onAdminDeleteAppointment,
  onOpenCaja,
}: DashboardViewProps) {
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [selectedReportStatusIds, setSelectedReportStatusIds] = useState<string[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getStudioWeekStart(new Date()));
  const [weekTickets, setWeekTickets] = useState<PosCashTicket[]>([]);
  const [weekPayments, setWeekPayments] = useState<PosPayment[]>([]);
  const [isLoadingCajaBoard, setIsLoadingCajaBoard] = useState(false);
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<string | null>(null);
  const [sendToCajaAppointment, setSendToCajaAppointment] = useState<Appointment | null>(null);
  const [cajaRefreshKey, setCajaRefreshKey] = useState(0);
  const [adminAction, setAdminAction] = useState<{
    type: AdminAppointmentAction;
    appointment: Appointment;
  } | null>(null);
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);

  const operationalStaff = useMemo(() => getBookableStaff(staffList), [staffList]);
  const weekDays = useMemo(() => buildWeekDayEntries(weekStart), [weekStart]);
  const weekDateLabels = useMemo(
    () => new Set(weekDays.map((day) => day.dateLabel)),
    [weekDays]
  );
  const weekRangeLabel = formatWeekRangeLabel(weekStart);
  const viewingCurrentWeek = isCurrentWeek(weekStart);

  useEffect(() => {
    let cancelled = false;

    const loadCajaBoard = async () => {
      setIsLoadingCajaBoard(true);
      try {
        const dates = weekDays.map((day) => day.dateLabel);
        const [ticketResults, paymentResults] = await Promise.all([
          Promise.all(
            dates.map((date) => posApi.getCashTickets({ date, status: 'all' }))
          ),
          Promise.all(dates.map((date) => posApi.getPayments({ date }))),
        ]);

        if (cancelled) return;

        const tickets = ticketResults.flatMap((result) => result.tickets || []);
        const payments = paymentResults.flatMap((result) => result.payments || []);
        setWeekTickets(tickets);
        setWeekPayments(payments);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setWeekTickets([]);
          setWeekPayments([]);
        }
      } finally {
        if (!cancelled) setIsLoadingCajaBoard(false);
      }
    };

    loadCajaBoard();

    return () => {
      cancelled = true;
    };
  }, [weekDays, cajaRefreshKey]);

  const appointmentById = useMemo(
    () => new Map(appointments.map((appointment) => [appointment.id, appointment])),
    [appointments]
  );

  const visibleAppointments = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            weekDateLabels.has(appointment.date) &&
            matchesStaffFilter(appointment.staffId, selectedStaffIds)
        )
        .sort((a, b) => {
          const byDate = compareSpanishShortDates(a.date, b.date);
          if (byDate !== 0) return byDate;
          return a.time.localeCompare(b.time);
        }),
    [appointments, selectedStaffIds, weekDateLabels]
  );

  const appointmentsByStatus = useMemo(
    () => ({
      agendado: visibleAppointments.filter(
        (appointment) => normalizeAppointmentStatus(appointment.status) === 'agendado'
      ),
      confirmado: visibleAppointments.filter(
        (appointment) => normalizeAppointmentStatus(appointment.status) === 'confirmado'
      ),
      terminado: visibleAppointments.filter(
        (appointment) => normalizeAppointmentStatus(appointment.status) === 'terminado'
      ),
    }),
    [visibleAppointments]
  );

  const visibleTickets = useMemo(
    () =>
      weekTickets.filter(
        (ticket) =>
          weekDateLabels.has(ticket.appointmentDate) &&
          matchesStaffFilter(ticket.staffId, selectedStaffIds)
      ),
    [weekTickets, weekDateLabels, selectedStaffIds]
  );

  const submittedAppointmentIds = useMemo(() => {
    const ids = new Set<string>();
    visibleTickets.forEach((ticket) => {
      if (ticket.status === 'submitted') ids.add(ticket.appointmentId);
    });
    return ids;
  }, [visibleTickets]);

  const chargedAppointmentIds = useMemo(() => {
    const ids = new Set<string>();
    visibleTickets.forEach((ticket) => {
      if (ticket.status === 'charged') ids.add(ticket.appointmentId);
    });
    weekPayments.forEach((payment) => {
      if (
        payment.transactionType !== 'gift_card_sale' &&
        weekDateLabels.has(payment.appointmentDate) &&
        matchesStaffFilter(payment.staffId, selectedStaffIds)
      ) {
        ids.add(payment.appointmentId);
      }
    });
    return ids;
  }, [visibleTickets, weekPayments, weekDateLabels, selectedStaffIds]);

  const cajaBoardColumns = useMemo(() => {
    const toTicketCard = (ticket: PosCashTicket): BoardCard => {
      const appointment = appointmentById.get(ticket.appointmentId);
      return {
        id: ticket.id,
        appointmentId: ticket.appointmentId,
        date: ticket.appointmentDate,
        time: appointment?.time || '',
        clientName: ticket.clientName,
        serviceName:
          ticket.lines.map((line) => line.name).filter(Boolean).join(', ') ||
          appointment?.serviceName ||
          'Servicio',
        staffId: ticket.staffId,
        staffName: ticket.staffName,
        amount: ticket.subtotal,
      };
    };

    const pendingToSend: BoardCard[] = appointmentsByStatus.terminado
      .filter(
        (appointment) =>
          !submittedAppointmentIds.has(appointment.id) &&
          !chargedAppointmentIds.has(appointment.id)
      )
      .map((appointment) => ({
        id: appointment.id,
        appointmentId: appointment.id,
        date: appointment.date,
        time: appointment.time,
        clientName: appointment.clientName,
        serviceName: appointment.serviceName,
        staffId: appointment.staffId,
        staffName: appointment.staffName,
        amount: appointment.cost > 0 ? appointment.cost : undefined,
      }))
      .sort(sortBoardCards);

    const pendingCharge: BoardCard[] = visibleTickets
      .filter((ticket) => ticket.status === 'submitted')
      .map(toTicketCard)
      .sort(sortBoardCards);

    const chargedTickets = visibleTickets.filter((ticket) => ticket.status === 'charged');
    const chargedTicketAppointmentIds = new Set(
      chargedTickets.map((ticket) => ticket.appointmentId)
    );

    const chargedFromTickets = chargedTickets.map(toTicketCard);

    const chargedFromPaymentsOnly: BoardCard[] = weekPayments
      .filter(
        (payment) =>
          payment.transactionType !== 'gift_card_sale' &&
          weekDateLabels.has(payment.appointmentDate) &&
          matchesStaffFilter(payment.staffId, selectedStaffIds) &&
          !chargedTicketAppointmentIds.has(payment.appointmentId)
      )
      .map((payment) => {
        const appointment = appointmentById.get(payment.appointmentId);
        return {
          id: payment.id,
          appointmentId: payment.appointmentId,
          date: payment.appointmentDate,
          time: appointment?.time || '',
          clientName: payment.clientName,
          serviceName: payment.serviceName || appointment?.serviceName || 'Servicio',
          staffId: payment.staffId,
          staffName: payment.staffName,
          amount: payment.total || payment.amount,
        };
      });

    return {
      pendingToSend,
      pendingCharge,
      charged: [...chargedFromTickets, ...chargedFromPaymentsOnly].sort(sortBoardCards),
    };
  }, [
    appointmentsByStatus.terminado,
    submittedAppointmentIds,
    chargedAppointmentIds,
    visibleTickets,
    weekPayments,
    weekDateLabels,
    selectedStaffIds,
    appointmentById,
  ]);

  const toggleStaff = (staffId: string) => {
    setSelectedStaffIds((current) => {
      if (current.length === 0) return [staffId];
      if (current.includes(staffId)) {
        const next = current.filter((id) => id !== staffId);
        return next.length === 0 ? [] : next;
      }
      return [...current, staffId];
    });
  };

  const agendaStatusColumns = [
    {
      id: 'agendado' as const,
      label: 'Agendadas',
      accent: 'bg-amber-500',
      countClass: 'bg-amber-100 text-amber-900',
      items: appointmentsByStatus.agendado.map((appointment) => ({
        id: appointment.id,
        appointmentId: appointment.id,
        date: appointment.date,
        time: appointment.time,
        clientName: appointment.clientName,
        serviceName: appointment.serviceName,
        staffId: appointment.staffId,
        staffName: appointment.staffName,
        amount: appointment.cost > 0 ? appointment.cost : undefined,
      })),
    },
    {
      id: 'confirmado' as const,
      label: 'Confirmadas',
      accent: 'bg-sky-500',
      countClass: 'bg-sky-100 text-sky-900',
      items: appointmentsByStatus.confirmado.map((appointment) => ({
        id: appointment.id,
        appointmentId: appointment.id,
        date: appointment.date,
        time: appointment.time,
        clientName: appointment.clientName,
        serviceName: appointment.serviceName,
        staffId: appointment.staffId,
        staffName: appointment.staffName,
        amount: appointment.cost > 0 ? appointment.cost : undefined,
      })),
    },
    {
      id: 'terminado' as const,
      label: 'Terminadas',
      accent: 'bg-emerald-500',
      countClass: 'bg-emerald-100 text-emerald-900',
      items: appointmentsByStatus.terminado.map((appointment) => ({
        id: appointment.id,
        appointmentId: appointment.id,
        date: appointment.date,
        time: appointment.time,
        clientName: appointment.clientName,
        serviceName: appointment.serviceName,
        staffId: appointment.staffId,
        staffName: appointment.staffName,
        amount: appointment.cost > 0 ? appointment.cost : undefined,
      })),
    },
  ];

  const cajaStatusColumns = [
    {
      id: 'pendingToSend',
      label: 'Pendientes por enviar',
      accent: 'bg-orange-500',
      countClass: 'bg-orange-100 text-orange-900',
      items: cajaBoardColumns.pendingToSend,
    },
    {
      id: 'pendingCharge',
      label: 'Por cobrar',
      accent: 'bg-violet-500',
      countClass: 'bg-violet-100 text-violet-900',
      items: cajaBoardColumns.pendingCharge,
    },
    {
      id: 'charged',
      label: 'Cobradas',
      accent: 'bg-teal-500',
      countClass: 'bg-teal-100 text-teal-900',
      items: cajaBoardColumns.charged,
    },
  ];

  const reportStatusOptions = useMemo(
    () =>
      [...agendaStatusColumns, ...cajaStatusColumns].map((column) => ({
        id: column.id as string,
        label: column.label,
        accent: column.accent,
        items: column.items,
      })),
    [agendaStatusColumns, cajaStatusColumns]
  );

  const toggleReportStatus = (statusId: string) => {
    setSelectedReportStatusIds((current) => {
      if (current.length === 0) return [statusId];
      if (current.includes(statusId)) {
        const next = current.filter((id) => id !== statusId);
        return next.length === 0 ? [] : next;
      }
      return [...current, statusId];
    });
  };

  const reportRowCount = useMemo(
    () =>
      reportStatusOptions
        .filter(
          (option) =>
            selectedReportStatusIds.length === 0 ||
            selectedReportStatusIds.includes(option.id)
        )
        .reduce((sum, option) => sum + option.items.length, 0),
    [reportStatusOptions, selectedReportStatusIds]
  );

  const handleGenerateReport = async () => {
    const selectedColumns = reportStatusOptions.filter(
      (option) =>
        selectedReportStatusIds.length === 0 ||
        selectedReportStatusIds.includes(option.id)
    );

    const rows = selectedColumns.flatMap((option) =>
      option.items.map((item) => ({
        Estatus: option.label,
        Fecha: item.date,
        Hora: item.time || '',
        Cliente: item.clientName,
        Servicio: item.serviceName,
        Manicurista: item.staffName,
        Monto:
          typeof item.amount === 'number' && item.amount > 0 ? item.amount : '',
      }))
    );

    if (rows.length === 0) {
      window.alert('No hay citas para los estatus seleccionados en esta semana.');
      return;
    }

    const staffLabel =
      selectedStaffIds.length === 0
        ? 'Todas las manicuristas'
        : selectedStaffIds
            .map((id) => staffList.find((staff) => staff.id === id)?.name || id)
            .join(', ');

    const headers = [
      'Estatus',
      'Fecha',
      'Hora',
      'Cliente',
      'Servicio',
      'Manicurista',
      'Monto',
    ];

    const XLSX = await import('xlsx');

    const sheetData = [
      [`Reporte de citas · ${weekRangeLabel}`],
      [staffLabel],
      [],
      headers,
      ...rows.map((row) => [
        row.Estatus,
        row.Fecha,
        row.Hora,
        row.Cliente,
        row.Servicio,
        row.Manicurista,
        row.Monto,
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 14 },
      { wch: 8 },
      { wch: 26 },
      { wch: 30 },
      { wch: 18 },
      { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Citas');

    const [, startDay] = weekRangeLabel.split(' ');
    XLSX.writeFile(workbook, `reporte-citas-${startDay || 'semana'}.xlsx`);
  };

  const handleAdvanceAppointment = async (
    appointmentId: string,
    status: AppointmentStatus
  ) => {
    setUpdatingAppointmentId(appointmentId);
    try {
      await onUpdateAppointmentStatus(appointmentId, status);
    } finally {
      setUpdatingAppointmentId(null);
    }
  };

  const handleSendToCaja = (appointmentId: string) => {
    const appointment = appointmentById.get(appointmentId);
    if (appointment) setSendToCajaAppointment(appointment);
  };

  const openAdminAction = (type: AdminAppointmentAction, appointmentId: string) => {
    const appointment = appointmentById.get(appointmentId);
    if (!appointment) return;
    setAdminAction({ type, appointment });
  };

  const handleConfirmAdminAction = async () => {
    if (!adminAction) return;
    const { type, appointment } = adminAction;
    setIsAdminSubmitting(true);
    try {
      if (type === 'revert' && onAdminRevertAppointmentStatus) {
        await onAdminRevertAppointmentStatus(appointment.id);
      } else if (type === 'cancel' && onAdminCancelAppointment) {
        await onAdminCancelAppointment(appointment.id);
      } else if (type === 'delete' && onAdminDeleteAppointment) {
        await onAdminDeleteAppointment(appointment.id);
      }
      setAdminAction(null);
      setCajaRefreshKey((current) => current + 1);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : 'No se pudo completar la acción de administrador.'
      );
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  const renderAdminActions = (item: BoardCard) => {
    if (!canManageStatuses) return null;
    const appointment = appointmentById.get(item.appointmentId);
    if (!appointment) return null;

    const previous = getPreviousAppointmentStatus(appointment.status);
    const canRevert = Boolean(previous) && Boolean(onAdminRevertAppointmentStatus);
    const canCancel =
      normalizeAppointmentStatus(appointment.status) !== 'cancelled' &&
      Boolean(onAdminCancelAppointment);
    const canDelete = Boolean(onAdminDeleteAppointment);

    if (!canRevert && !canCancel && !canDelete) return null;

    return (
      <div className="mt-2 pt-2 border-t border-dashed border-primary/10 space-y-1.5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-outline">
          Admin
        </p>
        <div className="flex flex-wrap gap-1.5">
          {canRevert ? (
            <button
              type="button"
              onClick={() => openAdminAction('revert', item.appointmentId)}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-primary/15 text-[9px] font-bold uppercase tracking-wider text-primary hover:bg-surface transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Retroceder
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              onClick={() => openAdminAction('cancel', item.appointmentId)}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-amber-200 text-[9px] font-bold uppercase tracking-wider text-amber-800 hover:bg-amber-50 transition-colors"
            >
              <Ban className="w-3 h-3" />
              Cancelar
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={() => openAdminAction('delete', item.appointmentId)}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-red-200 text-[9px] font-bold uppercase tracking-wider text-red-700 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Eliminar
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const renderCardAction = (columnId: string, item: BoardCard) => {
    if (!canManageStatuses || columnId === 'charged') {
      return renderAdminActions(item);
    }

    let primary: ReactNode = null;

    if (columnId === 'agendado') {
      primary = (
        <button
          type="button"
          disabled={updatingAppointmentId === item.appointmentId}
          onClick={() => handleAdvanceAppointment(item.appointmentId, 'confirmado')}
          className="mt-3 w-full px-3 py-2 rounded-lg bg-sky-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-sky-700 disabled:opacity-50 transition-colors"
        >
          {updatingAppointmentId === item.appointmentId ? 'Actualizando…' : 'Confirmar'}
        </button>
      );
    } else if (columnId === 'confirmado') {
      primary = (
        <button
          type="button"
          disabled={updatingAppointmentId === item.appointmentId}
          onClick={() => handleAdvanceAppointment(item.appointmentId, 'terminado')}
          className="mt-3 w-full px-3 py-2 rounded-lg bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {updatingAppointmentId === item.appointmentId ? 'Actualizando…' : 'Terminar'}
        </button>
      );
    } else if (columnId === 'terminado' || columnId === 'pendingToSend') {
      primary = (
        <button
          type="button"
          onClick={() => handleSendToCaja(item.appointmentId)}
          className="mt-3 w-full px-3 py-2 rounded-lg bg-slate-300 text-slate-950 border border-slate-400 text-[10px] font-bold uppercase tracking-wider shadow-sm hover:bg-slate-400 transition-colors"
        >
          Enviar a caja
        </button>
      );
    } else if (columnId === 'pendingCharge') {
      primary = (
        <button
          type="button"
          onClick={onOpenCaja}
          className="mt-3 w-full px-3 py-2 rounded-lg bg-slate-300 text-slate-950 border border-slate-400 text-[10px] font-bold uppercase tracking-wider shadow-sm hover:bg-slate-400 transition-colors"
        >
          Cobrar en caja
        </button>
      );
    }

    return (
      <>
        {primary}
        {renderAdminActions(item)}
      </>
    );
  };

  const renderColumnGrid = (
    columns: Array<{
      id: string;
      label: string;
      accent: string;
      countClass: string;
      items: BoardCard[];
    }>
  ) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-primary/5">
      {columns.map((column) => (
        <div key={column.id} className="bg-surface-container-lowest min-w-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-primary/5">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${column.accent}`} />
              <h4 className="font-display font-bold text-sm text-primary truncate">
                {column.label}
              </h4>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${column.countClass}`}
            >
              {column.items.length}
            </span>
          </div>

          <div className="p-4 space-y-3 max-h-[30rem] overflow-y-auto">
            {column.items.length === 0 ? (
              <p className="py-10 text-center text-xs text-outline">
                {isLoadingCajaBoard &&
                (column.id === 'pendingToSend' ||
                  column.id === 'pendingCharge' ||
                  column.id === 'charged')
                  ? 'Cargando…'
                  : `No hay citas ${column.label.toLowerCase()} en esta semana.`}
              </p>
            ) : (
              column.items.map((item) => (
                <article
                  key={item.id}
                  className="p-4 rounded-xl bg-surface-container-low border border-primary/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-sans font-bold text-sm text-primary truncate">
                        {item.clientName}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1 truncate">
                        {item.serviceName}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="font-mono text-[10px] font-bold text-outline">
                        {item.date}
                      </p>
                      {item.time ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-primary">
                          <Clock3 className="w-3.5 h-3.5 text-secondary" />
                          {item.time}
                        </span>
                      ) : null}
                      {typeof item.amount === 'number' && item.amount > 0 ? (
                        <p className="font-display text-[11px] font-bold text-primary">
                          {formatServicePrice(item.amount)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-primary/5 flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: staffList.find(
                          (staff) => staff.id === item.staffId
                        )?.color,
                      }}
                    />
                    <span className="text-[10px] font-bold text-outline truncate">
                      {item.staffName}
                    </span>
                  </div>
                  {renderCardAction(column.id, item)}
                </article>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in p-1 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-secondary font-sans text-xs font-bold tracking-widest uppercase">
            Panel Ejecutivo
          </span>
          <h2 className="font-display text-3xl font-bold text-primary mt-1">
            Gestión Operativa
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Control diario en tiempo real de studio aé premium manicure & spa.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenNewClient}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary/10 text-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-surface-container-low transition-colors"
          >
            <UserPlus className="w-4 h-4 text-secondary" />
            <span>Registrar Cliente</span>
          </button>
          <button
            onClick={onOpenNewAppointment}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-all shadow-sm shadow-primary/10"
          >
            <Plus className="w-4 h-4 text-secondary" />
            <span>Nueva Cita</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-6 items-stretch">
        <div className="h-full min-h-0">
          <WeeklyCompletedAppointmentsCard />
        </div>

        <div className="md:col-span-2 h-full min-h-0">
          <WeeklySalesCard />
        </div>

        <div className="h-full min-h-0">
          <CabinOccupancyCard staffList={staffList} />
        </div>

        <div className="md:col-span-2 h-full min-h-0">
          <WeeklyCutsCard />
        </div>
      </div>

      <section className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden">
        <div className="p-5 md:p-6 border-b border-primary/5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <h3 className="font-display text-lg font-bold text-primary">
                Citas de la semana
              </h3>
              <p className="text-xs text-outline mt-1">
                Agenda y caja · sábado a viernes
              </p>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-primary/10 bg-surface px-1 py-1 self-start">
              <button
                type="button"
                onClick={() => setWeekStart((prev) => addDays(prev, -7))}
                title="Semana anterior"
                className="p-1.5 rounded-lg hover:bg-surface-container-low text-primary transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setWeekStart(getStudioWeekStart(new Date()))}
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
                onClick={() => setWeekStart((prev) => addDays(prev, 7))}
                title="Semana siguiente"
                className="p-1.5 rounded-lg hover:bg-surface-container-low text-primary transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary mr-1">
              <Calendar className="w-3.5 h-3.5 text-secondary" />
              {weekRangeLabel}
            </span>
            <button
              type="button"
              onClick={() => setSelectedStaffIds([])}
              className={`px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                selectedStaffIds.length === 0
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface text-primary border-primary/10 hover:bg-surface-container-low'
              }`}
            >
              Todas
            </button>
            {operationalStaff.map((staff) => {
              const selected = selectedStaffIds.includes(staff.id);
              return (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => toggleStaff(staff.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-colors ${
                    selected
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface text-primary border-primary/10 hover:bg-surface-container-low'
                  }`}
                >
                  {selected ? <CheckCircle2 className="w-3 h-3" /> : null}
                  {staff.name}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-primary/5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-secondary" />
                <h4 className="font-display font-bold text-sm text-primary">
                  Generar reportes
                </h4>
              </div>
              <button
                type="button"
                onClick={handleGenerateReport}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-sans text-[10px] font-bold uppercase tracking-wider hover:bg-primary-container transition-colors shadow-sm shadow-primary/10 self-start sm:self-auto"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-secondary" />
                Descargar Excel ({reportRowCount})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedReportStatusIds([])}
                className={`px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  selectedReportStatusIds.length === 0
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface text-primary border-primary/10 hover:bg-surface-container-low'
                }`}
              >
                Todos
              </button>
              {reportStatusOptions.map((option) => {
                const selected = selectedReportStatusIds.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleReportStatus(option.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-colors ${
                      selected
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface text-primary border-primary/10 hover:bg-surface-container-low'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${option.accent}`} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {renderColumnGrid(agendaStatusColumns)}

        <div className="px-5 py-3 border-y border-primary/5 bg-surface-container-low/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
            Flujo de caja
          </p>
        </div>

        {renderColumnGrid(cajaStatusColumns)}
      </section>

      <WeeklyWeekComparisonCard weekStart={weekStart} />

      {sendToCajaAppointment ? (
        <SendToCajaModal
          appointment={sendToCajaAppointment}
          services={services}
          staffName={sendToCajaAppointment.staffName}
          onClose={() => setSendToCajaAppointment(null)}
          onSubmitted={async () => {
            setCajaRefreshKey((current) => current + 1);
          }}
        />
      ) : null}

      {adminAction ? (
        <AdminAppointmentConfirmModal
          action={adminAction.type}
          clientName={adminAction.appointment.clientName}
          date={adminAction.appointment.date}
          time={adminAction.appointment.time}
          staffName={adminAction.appointment.staffName}
          status={adminAction.appointment.status}
          isPaid={chargedAppointmentIds.has(adminAction.appointment.id)}
          isSubmitting={isAdminSubmitting}
          onConfirm={handleConfirmAdminAction}
          onClose={() => {
            if (!isAdminSubmitting) setAdminAction(null);
          }}
        />
      ) : null}
    </div>
  );
}
