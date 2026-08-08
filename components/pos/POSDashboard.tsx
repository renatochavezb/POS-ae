"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Menu, 
  X, 
  Plus, 
  UserPlus, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle,
  Award,
  Calendar,
  DollarSign,
  Search,
  Minus
} from 'lucide-react';

// Data & Types
import { 
  INITIAL_STAFF, 
  INITIAL_APPOINTMENTS, 
  INITIAL_SERVICES,
  INITIAL_BLOCKED_SLOTS,
  formatServicePrice,
  getStaffForService,
  getServicesForStaff,
  INITIAL_RECEPTIONISTS
} from './data';
import { STAFF_COLOR_PALETTE } from './staffColors';
import { Client, Staff, Appointment, Service, StaffStatus, StaffBlockedSlot, Receptionist, AppointmentStatus, ScheduleConfig } from './types';
import {
  DEFAULT_SCHEDULE_CONFIG,
  buildBookingTimeOptions,
  buildDayScheduleConfigForLabel,
  buildAgendaDateLabelsForWeekStarts,
  formatSpanishShortDate,
  formatSpanishShortDateFromYmd,
  getDefaultAgendaWeekStarts,
  getStudioWeekStart,
  getStudioWeekStartLabel,
  getTodaySpanishShortDate,
  getDurationOptionsFromConfig,
  formatDuration,
  isStaffTimeBlocked,
  rangesOverlapMinutes,
  parseTimeToMinutes,
  getConflictingAppointment,
  formatAppointmentTimeRange,
  resolveScheduleForDateLabel,
  buildWeekDayEntries,
  calendarDateToYmd,
} from './scheduleUtils';

// Visual Components
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import type { DashboardSectionId } from './dashboardNav';
import AgendaView from './components/AgendaView';
import { AppointmentEditPayload } from './components/AppointmentEditModal';
import ClientsView from './components/ClientsView';
import ClientProfileView from './components/ClientProfileView';
import { ClientEditPayload } from './components/ClientEditModal';
import StaffView from './components/StaffView';
import StaffDeactivateModal from './components/StaffDeactivateModal';
import StaffAnalyticsView from './components/StaffAnalyticsView';
import ServicesView from './components/ServicesView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import StudioLogo from './components/StudioLogo';
import CajaView from './components/CajaView';
import InventarioView from './components/InventarioView';
import MasterReceptionLogView from './components/MasterReceptionLogView';
import AdminGastosView from './admin/AdminGastosView';
import AdminPreciosView from './admin/AdminPreciosView';
import AdminProveedoresView from './admin/AdminProveedoresView';
import AdminComprasView from './admin/AdminComprasView';
import AdminCuentasPagarView from './admin/AdminCuentasPagarView';
import {
  ADMIN_NAV_ITEMS,
  filterAdminNavByRole,
} from './admin/adminNav';
import posApi, { ReceptionistAuthPayload } from '@/libs/posApi';
import { getBookableStaff } from '@/libs/posStaffAgenda';
import { readPosSession, writePosSession, clearPosSession, PosSession, getActiveReceptionistSession, markAccountantLogoutRecorded, wasAccountantLogoutRecorded } from '@/libs/posSession';

const MANICURISTA_TAB_IDS = ['agenda', 'staff', 'caja'];
const RECEPTIONIST_ADMIN_TAB_IDS = ADMIN_NAV_ITEMS.filter((item) =>
  item.roles.includes('reception')
).map((item) => item.id);
const ACCOUNTANT_ADMIN_TAB_IDS = [
  'admin-gastos',
  'admin-proveedores',
  'admin-compras',
  'admin-cuentas-pagar',
];
const RECEPTIONIST_TAB_IDS = [
  'agenda',
  'caja',
  'clients',
  'staff',
  'services',
  'inventario',
  ...RECEPTIONIST_ADMIN_TAB_IDS,
];
const ACCOUNTANT_TAB_IDS = ['staff', 'inventario', ...ACCOUNTANT_ADMIN_TAB_IDS];
/** Agenda por defecto: semana anterior + semana en curso (sáb–vie). */

const isReceptionSupervisorRole = (role?: string) => /supervis/i.test(role || '');
import { isAppointmentPaid, canDeleteAppointment, canCancelAppointment, isAppointmentLockedOnBoard, getNextAppointmentStatus, getPreviousAppointmentStatus } from './appointmentStatus';

type BookingServiceLine = {
  key: string;
  serviceId: string;
  customName: string;
  quantity: number;
  nailScope: 'manos' | 'manos_pies' | '';
};

const createBookingServiceKey = () =>
  `bs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const createBookingServiceLine = (
  services: Service[],
  serviceId?: string
): BookingServiceLine => {
  const id = serviceId || (services[0]?.id ?? '');
  const catalog = services.find((service) => service.id === id);
  const isPerNail = catalog?.pricingMode === 'per_nail';
  return {
    key: createBookingServiceKey(),
    serviceId: id,
    customName: '',
    quantity: isPerNail ? 10 : 1,
    nailScope: isPerNail ? 'manos' : '',
  };
};

const getStaffForServiceIds = (serviceIds: string[], staffList: Staff[]) => {
  const ids = serviceIds.filter(Boolean);
  if (ids.length === 0) return staffList;

  return ids.reduce((acc, serviceId, index) => {
    const eligible = getStaffForService(serviceId, staffList);
    if (index === 0) return eligible;
    const eligibleIds = new Set(eligible.map((member) => member.id));
    return acc.filter((member) => eligibleIds.has(member.id));
  }, [] as Staff[]);
};

const resolveBookingServices = (
  lines: BookingServiceLine[],
  mode: 'custom' | 'catalog',
  services: Service[]
) => {
  const resolved = lines.map((line) => {
    if (mode === 'custom') {
      return {
        name: line.customName.trim(),
        subtitle: 'Servicio personalizado',
        image: '',
        cost: 0,
        duration: 60,
        isValid: line.customName.trim().length > 0,
      };
    }

    const catalog = services.find((service) => service.id === line.serviceId);
    if (!catalog) {
      return {
        name: '',
        subtitle: '',
        image: '',
        cost: 0,
        duration: 60,
        isValid: false,
      };
    }

    const isPerNail = catalog.pricingMode === 'per_nail';
    const quantity = isPerNail
      ? Math.max(1, Math.min(line.quantity || 1, catalog.nailMax || 20))
      : 1;
    const cost =
      isPerNail ? (catalog.price || 0) * quantity : catalog.price || 0;
    const name = isPerNail
      ? `${catalog.name} × ${quantity}${
          line.nailScope === 'manos_pies'
            ? ' (manos y pies)'
            : line.nailScope === 'manos'
              ? ' (manos)'
              : ''
        }`
      : catalog.name;

    return {
      name,
      subtitle: catalog.subtitle ?? '',
      image: catalog.image ?? '',
      cost,
      duration: catalog.duration ?? 60,
      isValid: true,
    };
  });

  const valid = resolved.filter((item) => item.isValid);

  return {
    isValid: valid.length === lines.length && lines.length > 0,
    serviceName: valid.map((item) => item.name).join(' + '),
    serviceSubtitle:
      valid.length > 1 ? 'Múltiples servicios' : valid[0]?.subtitle ?? '',
    serviceImage: valid[0]?.image ?? '',
    cost: valid.reduce((sum, item) => sum + item.cost, 0),
    duration: valid.reduce((sum, item) => sum + item.duration, 0),
  };
};

export default function POSDashboard() {
  // Main Navigation state
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [dashboardSection, setDashboardSection] = useState<DashboardSectionId | null>(null);
  const [dashboardScrollToken, setDashboardScrollToken] = useState(0);
  const [isSessionValidated, setIsSessionValidated] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dbWarning, setDbWarning] = useState<string | null>(null);
  
  // Drill-down selection state for CRM/Staff profiles
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  
  // Mobile navigation drawer toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileLogoClicks, setMobileLogoClicks] = useState(0);

  // Core reactive database states
  const [clients, setClients] = useState<Client[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>(INITIAL_STAFF);
  const [receptionists, setReceptionists] = useState<Receptionist[]>(INITIAL_RECEPTIONISTS);
  const [loggedInReceptionistId, setLoggedInReceptionistId] = useState<string | null>(null);
  const [loggedInAccountantId, setLoggedInAccountantId] = useState<string | null>(null);
  const [loggedInAccountantName, setLoggedInAccountantName] = useState<string | null>(null);
  const [loggedInStaffId, setLoggedInStaffId] = useState<string | null>(null);
  const [isMasterSession, setIsMasterSession] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [blockedSlots, setBlockedSlots] = useState<StaffBlockedSlot[]>(INITIAL_BLOCKED_SLOTS);
  const [services, setServices] = useState<Service[]>(INITIAL_SERVICES);
  const [ticketAppointmentIds, setTicketAppointmentIds] = useState<string[]>([]);
  const [liveSyncAt, setLiveSyncAt] = useState(0);
  const [isAgendaRefreshing, setIsAgendaRefreshing] = useState(false);
  const [isLoadingAgendaWeek, setIsLoadingAgendaWeek] = useState(false);
  const [loadedAgendaWeekKeys, setLoadedAgendaWeekKeys] = useState<string[]>([]);
  const agendaPollInFlight = useRef(false);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE_CONFIG);

  // Overlay Dialog Triggers
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffPendingDeactivation, setStaffPendingDeactivation] = useState<Staff | null>(null);
  const [isDeactivatingStaff, setIsDeactivatingStaff] = useState(false);
  const [staffDeactivateError, setStaffDeactivateError] = useState<string | null>(null);
  const [accountantActivityRefresh, setAccountantActivityRefresh] = useState(0);

  const bumpAccountantActivity = () =>
    setAccountantActivityRefresh((value) => value + 1);

  // Appointment creation form fields
  const [bookingClient, setBookingClient] = useState('');
  const [bookingClientSearchMode, setBookingClientSearchMode] = useState(false);
  const [bookingClientQuery, setBookingClientQuery] = useState('');
  const [bookingServiceMode, setBookingServiceMode] = useState<'custom' | 'catalog'>('custom');
  const [bookingServices, setBookingServices] = useState<BookingServiceLine[]>(() => [
    createBookingServiceLine(INITIAL_SERVICES),
  ]);
  const [bookingStaffId, setBookingStaffId] = useState('');
  const [bookingStaffLocked, setBookingStaffLocked] = useState(false);
  const [bookingDate, setBookingDate] = useState(getTodaySpanishShortDate());
  const [bookingTime, setBookingTime] = useState('10:00 AM');
  const [bookingDuration, setBookingDuration] = useState(60);

  const bookingDaySchedule = useMemo(
    () => resolveScheduleForDateLabel(bookingDate, scheduleConfig),
    [bookingDate, scheduleConfig]
  );

  const bookingDayConfig = useMemo(
    () => buildDayScheduleConfigForLabel(bookingDate, scheduleConfig),
    [bookingDate, scheduleConfig]
  );

  const bookingTimeOptions = useMemo(
    () => buildBookingTimeOptions(bookingDayConfig),
    [bookingDayConfig]
  );

  // Client creation form fields
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientBirthday, setNewClientBirthday] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientBio, setNewClientBio] = useState('');
  const [newClientAlerts, setNewClientAlerts] = useState('');

  // Staff recruitment form fields
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Generalista en crecimiento');
  const [newStaffSpecialty, setNewStaffSpecialty] = useState('');
  const [newStaffShift, setNewStaffShift] = useState('Completo');
  const [newStaffBio, setNewStaffBio] = useState('');

  const applyStoredSession = (session: PosSession) => {
    setLoggedInReceptionistId(
      session.role === 'reception' ? (session.receptionistId || null) : null
    );
    setLoggedInAccountantId(
      session.role === 'accountant' ? (session.accountantId || null) : null
    );
    setLoggedInAccountantName(
      session.role === 'accountant' ? (session.accountantName || null) : null
    );
    setIsMasterSession(Boolean(session.isMaster));

    if (session.role === 'manicurista' && session.staffId) {
      setLoggedInStaffId(session.staffId);
      setSelectedStaffId(session.staffId);
      setCurrentTab(session.isMaster ? 'staff' : 'agenda');
    } else {
      setLoggedInStaffId(null);
    }

    if (session.role === 'accountant') {
      setSelectedStaffId(null);
      setSelectedClientId(null);
      setCurrentTab('staff');
    }

    if (session.role === 'reception') {
      const receptionist =
        INITIAL_RECEPTIONISTS.find((member) => member.id === session.receptionistId) || null;
      const isSupervisor =
        session.isMaster || isReceptionSupervisorRole(receptionist?.role);
      setCurrentTab(isSupervisor ? 'dashboard' : 'agenda');
      setSelectedStaffId(null);
      setSelectedClientId(null);
    }
  };

  const isAccountantSession = Boolean(loggedInAccountantId);
  const isManicuristaProfile = Boolean(loggedInStaffId);
  const isManicuristaSession = isManicuristaProfile && !isMasterSession;

  const handleLocalLogin = (
    role: 'reception' | 'manicurista' | 'accountant',
    staffId?: string,
    receptionistId?: string,
    isMaster?: boolean,
    accountantId?: string,
    accountantName?: string
  ) => {
    const session: PosSession = {
      role,
      staffId: role === 'manicurista' ? staffId : undefined,
      receptionistId: role === 'reception' ? receptionistId : undefined,
      accountantId: role === 'accountant' ? accountantId : undefined,
      accountantName: role === 'accountant' ? accountantName : undefined,
      isMaster: Boolean(isMaster),
    };

    writePosSession(session);
    applyStoredSession(session);
    setIsSessionValidated(true);
    void loadPosData({ silent: true });
  };

  const handlePosLogout = async () => {
    if (loggedInAccountantId) {
      try {
        await posApi.recordAccountantActivity({
          accountantId: loggedInAccountantId,
          action: 'logout',
          logoutReason: 'manual',
        });
        markAccountantLogoutRecorded();
      } catch (error) {
        console.error(error);
      }
    }

    clearPosSession();
    setIsSessionValidated(false);
    setLoggedInReceptionistId(null);
    setLoggedInAccountantId(null);
    setLoggedInAccountantName(null);
    setLoggedInStaffId(null);
    setIsMasterSession(false);
    setSelectedClientId(null);
    setSelectedStaffId(null);
    setCurrentTab('dashboard');
    setMobileMenuOpen(false);
    setAppointments([]);
    setClients([]);
    setBlockedSlots([]);
    setStaffList(INITIAL_STAFF);
    setReceptionists(INITIAL_RECEPTIONISTS);
  };

  useEffect(() => {
    const onPageHide = () => {
      if (wasAccountantLogoutRecorded()) return;
      const session = readPosSession();
      if (session?.role !== "accountant" || !session.accountantId) return;
      posApi.recordAccountantLogoutBeacon(session.accountantId);
    };

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  const getBookingReceptionist = () => {
    const receptionistId =
      getActiveReceptionistSession()?.id || loggedInReceptionistId;

    if (!receptionistId) return null;

    return (
      receptionists.find((member) => member.id === receptionistId) ||
      INITIAL_RECEPTIONISTS.find((member) => member.id === receptionistId) ||
      null
    );
  };

  const resolveActiveReceptionist = () => getBookingReceptionist();

  const loggedInReceptionist = resolveActiveReceptionist();
  const loggedInStaffMember = loggedInStaffId
    ? staffList.find((member) => member.id === loggedInStaffId) || null
    : null;

  const isPlainReceptionSession = Boolean(
    loggedInReceptionistId &&
      !isMasterSession &&
      !isReceptionSupervisorRole(loggedInReceptionist?.role)
  );

  const receptionSessionLabel = isMasterSession
    ? 'Acceso total'
    : isReceptionSupervisorRole(loggedInReceptionist?.role)
    ? 'Supervisión'
    : 'Recepción';

  const allowedTabIds = isAccountantSession
    ? ACCOUNTANT_TAB_IDS
    : isManicuristaSession
    ? MANICURISTA_TAB_IDS
    : isPlainReceptionSession
    ? RECEPTIONIST_TAB_IDS
    : undefined;

  const adminNavItems = useMemo(
    () =>
      filterAdminNavByRole(ADMIN_NAV_ITEMS, {
        isMaster: isMasterSession,
        isAccountant: isAccountantSession,
        isReception: Boolean(loggedInReceptionistId) && !isAccountantSession,
      }),
    [isMasterSession, isAccountantSession, loggedInReceptionistId]
  );

  const activeSession = isMasterSession && loggedInReceptionist
    ? {
        name: 'Administrador',
        subtitle: 'Acceso total',
        initials: 'AD',
      }
    : loggedInReceptionist
    ? {
        name: loggedInReceptionist.name,
        subtitle: receptionSessionLabel,
        initials: loggedInReceptionist.name
          .split(' ')
          .map((part) => part[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
      }
    : loggedInAccountantName
    ? {
        name: loggedInAccountantName,
        subtitle: 'Contabilidad · Liquidaciones',
        initials: loggedInAccountantName
          .split(' ')
          .map((part) => part[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
      }
    : isManicuristaSession && loggedInStaffMember
    ? {
        name: loggedInStaffMember.name,
        subtitle: 'Manicurista · Solo consulta',
        initials: loggedInStaffMember.name
          .split(' ')
          .map((part) => part[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
      }
    : isMasterSession
    ? {
        name: 'Master',
        subtitle: 'Acceso total',
        initials: 'M',
      }
    : null;

  const refreshTicketAppointmentIds = async () => {
    try {
      const result = await posApi.getCashTickets({
        date: getTodaySpanishShortDate(),
        status: 'submitted',
        staffId: loggedInStaffId || undefined,
      });
      setTicketAppointmentIds(result.tickets.map((ticket) => ticket.appointmentId));
    } catch (ticketError) {
      console.error(ticketError);
    }
  };

  const getDefaultAgendaFetchParams = () => {
    const [previousWeekStart] = getDefaultAgendaWeekStarts();
    return {
      weekStart: formatSpanishShortDateFromYmd(calendarDateToYmd(previousWeekStart)),
      weekCount: 2,
    };
  };

  const markDefaultAgendaWeeksLoaded = () => {
    setLoadedAgendaWeekKeys(
      getDefaultAgendaWeekStarts().map((weekStart) => getStudioWeekStartLabel(weekStart))
    );
  };

  const mergeAppointmentsForDates = (
    prev: Appointment[],
    fresh: Appointment[],
    dateLabels: Set<string>
  ) => {
    const kept = prev.filter((appointment) => !dateLabels.has(appointment.date));
    return [...kept, ...fresh];
  };

  const mergeBlockedSlotsForDates = (
    prev: StaffBlockedSlot[],
    fresh: StaffBlockedSlot[],
    dateLabels: Set<string>
  ) => {
    const kept = prev.filter((slot) => !dateLabels.has(slot.date));
    return [...kept, ...fresh];
  };

  const loadPosData = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsDataLoading(true);
      setDbWarning(null);
    }

    const agendaParams = getDefaultAgendaFetchParams();

    const results = await Promise.allSettled([
      posApi.getStaff(),
      posApi.getAppointments(agendaParams),
      posApi.getBlockedSlots(agendaParams),
      posApi.getClients(),
      posApi.getReceptionists(),
      posApi.getScheduleConfig(),
      posApi.getServices(),
    ]);

    const failedSections: string[] = [];

    if (results[0].status === 'fulfilled') {
      setStaffList(results[0].value);
    } else {
      failedSections.push('equipo');
      console.error(results[0].reason);
    }

    if (results[1].status === 'fulfilled') {
      const freshAppointments = results[1].value;
      if (options?.silent) {
        const liveDateLabels = new Set(
          buildAgendaDateLabelsForWeekStarts(getDefaultAgendaWeekStarts())
        );
        setAppointments((prev) =>
          mergeAppointmentsForDates(prev, freshAppointments, liveDateLabels)
        );
        setLoadedAgendaWeekKeys((prev) => {
          const next = new Set(prev);
          getDefaultAgendaWeekStarts().forEach((weekStart) => {
            next.add(getStudioWeekStartLabel(weekStart));
          });
          return Array.from(next);
        });
      } else {
        setAppointments(freshAppointments);
        markDefaultAgendaWeeksLoaded();
      }
    } else {
      failedSections.push('agenda');
      console.error(results[1].reason);
    }

    if (results[2].status === 'fulfilled') {
      const freshBlockedSlots = results[2].value;
      if (options?.silent) {
        const liveDateLabels = new Set(
          buildAgendaDateLabelsForWeekStarts(getDefaultAgendaWeekStarts())
        );
        setBlockedSlots((prev) =>
          mergeBlockedSlotsForDates(prev, freshBlockedSlots, liveDateLabels)
        );
      } else {
        setBlockedSlots(freshBlockedSlots);
      }
    } else {
      failedSections.push('cierres de horario');
      console.error(results[2].reason);
    }

    if (results[3].status === 'fulfilled') {
      setClients(results[3].value);
    } else {
      failedSections.push('clientes');
      console.error(results[3].reason);
    }

    if (results[4].status === 'fulfilled') {
      setReceptionists(results[4].value);
    } else {
      failedSections.push('recepción');
      console.error(results[4].reason);
    }

    if (results[5].status === 'fulfilled') {
      setScheduleConfig(results[5].value);
    } else {
      failedSections.push('horario del salón');
      console.error(results[5].reason);
    }

    if (results[6].status === 'fulfilled') {
      setServices(results[6].value);
    } else {
      failedSections.push('catálogo de servicios');
      console.error(results[6].reason);
    }

    await refreshTicketAppointmentIds();

    if (failedSections.length > 0 && !options?.silent) {
      setDbWarning(
        `No se pudo sincronizar: ${failedSections.join(', ')}. Reintenta para cargar todos los datos.`
      );
    }

    if (!options?.silent) {
      setIsDataLoading(false);
    }
  };

  const refreshLiveAgendaData = async () => {
    const agendaParams = getDefaultAgendaFetchParams();
    const liveDateLabels = new Set(
      buildAgendaDateLabelsForWeekStarts(getDefaultAgendaWeekStarts())
    );

    const [appointmentsResult, blockedSlotsResult] = await Promise.allSettled([
      posApi.getAppointments(agendaParams),
      posApi.getBlockedSlots(agendaParams),
    ]);

    if (appointmentsResult.status === 'fulfilled') {
      const fresh = appointmentsResult.value;
      setAppointments((prev) => mergeAppointmentsForDates(prev, fresh, liveDateLabels));
      setLoadedAgendaWeekKeys((prev) => {
        const next = new Set(prev);
        getDefaultAgendaWeekStarts().forEach((weekStart) => {
          next.add(getStudioWeekStartLabel(weekStart));
        });
        return Array.from(next);
      });
    }

    if (blockedSlotsResult.status === 'fulfilled') {
      const fresh = blockedSlotsResult.value;
      setBlockedSlots((prev) => mergeBlockedSlotsForDates(prev, fresh, liveDateLabels));
    }

    await refreshTicketAppointmentIds();
    setLiveSyncAt(Date.now());
  };

  const handleLoadAgendaWeek = async (weekStart: Date) => {
    const normalizedStart = getStudioWeekStart(weekStart);
    const weekKey = getStudioWeekStartLabel(normalizedStart);
    if (loadedAgendaWeekKeys.includes(weekKey) || isLoadingAgendaWeek) return;

    setIsLoadingAgendaWeek(true);
    try {
      const weekParams = {
        weekStart: weekKey,
        weekCount: 1,
      };
      const weekDateLabels = new Set(
        buildWeekDayEntries(normalizedStart).map((day) => day.dateLabel)
      );

      const [appointmentsResult, blockedSlotsResult] = await Promise.allSettled([
        posApi.getAppointments(weekParams),
        posApi.getBlockedSlots(weekParams),
      ]);

      if (appointmentsResult.status === 'fulfilled') {
        setAppointments((prev) =>
          mergeAppointmentsForDates(prev, appointmentsResult.value, weekDateLabels)
        );
        setLoadedAgendaWeekKeys((prev) =>
          prev.includes(weekKey) ? prev : [...prev, weekKey]
        );
      } else {
        console.error(appointmentsResult.reason);
      }

      if (blockedSlotsResult.status === 'fulfilled') {
        setBlockedSlots((prev) =>
          mergeBlockedSlotsForDates(prev, blockedSlotsResult.value, weekDateLabels)
        );
      } else {
        console.error(blockedSlotsResult.reason);
      }
    } finally {
      setIsLoadingAgendaWeek(false);
    }
  };

  const handleManualAgendaRefresh = async () => {
    if (agendaPollInFlight.current || isAgendaRefreshing) return;
    agendaPollInFlight.current = true;
    setIsAgendaRefreshing(true);
    try {
      await refreshLiveAgendaData();
    } catch (error) {
      console.error(error);
    } finally {
      agendaPollInFlight.current = false;
      setIsAgendaRefreshing(false);
    }
  };

  useEffect(() => {
    const storedSession = readPosSession();
    if (storedSession) {
      applyStoredSession(storedSession);
      setIsSessionValidated(true);
    }
    setSessionReady(true);
  }, []);

  useEffect(() => {
    if (!isSessionValidated) return;
    if (sessionStorage.getItem('posMasterSession') === 'true') {
      setIsMasterSession(true);
    }
    loadPosData();
  }, [isSessionValidated]);

  useEffect(() => {
    if (!isSessionValidated || !isMasterSession) return;

    posApi
      .getReceptionists()
      .then(setReceptionists)
      .catch((error) => console.error(error));
  }, [isSessionValidated, isMasterSession]);

  useEffect(() => {
    if (!isAccountantSession) return;
    if (!ACCOUNTANT_TAB_IDS.includes(currentTab)) {
      setCurrentTab('staff');
    }
    setSelectedClientId(null);
  }, [isAccountantSession, currentTab]);

  useEffect(() => {
    if (!isManicuristaSession || !loggedInStaffId) return;
    if (!MANICURISTA_TAB_IDS.includes(currentTab)) {
      setCurrentTab('agenda');
    }
    setSelectedClientId(null);
    setSelectedStaffId(loggedInStaffId);
  }, [isManicuristaSession, currentTab, loggedInStaffId]);

  useEffect(() => {
    if (!isPlainReceptionSession) return;
    if (!RECEPTIONIST_TAB_IDS.includes(currentTab)) {
      setCurrentTab('agenda');
    }
  }, [isPlainReceptionSession, currentTab]);

  useEffect(() => {
    if (!isMasterSession || mobileLogoClicks < 3 || isAccountantSession) return;

    setCurrentTab('master-log');
    setMobileLogoClicks(0);
    setMobileMenuOpen(false);
  }, [isMasterSession, mobileLogoClicks]);

  useEffect(() => {
    if (mobileLogoClicks === 0) return;

    const timer = window.setTimeout(() => setMobileLogoClicks(0), 900);
    return () => window.clearTimeout(timer);
  }, [mobileLogoClicks]);

  // Status Switcher (Online / Break / Offline)
  const handleUpdateStaffStatus = async (id: string, status: StaffStatus) => {
    const previousStaff = staffList;
    setStaffList((prev) =>
      prev.map((staff) => (staff.id === id ? { ...staff, status } : staff))
    );

    try {
      await posApi.updateStaff(id, { status });
    } catch (error) {
      console.error(error);
      setStaffList(previousStaff);
      window.alert('No se pudo actualizar el estado de la manicurista.');
    }
  };

  const handleStaffUpdated = (updated: Staff) => {
    setStaffList((prev) =>
      prev.map((member) => (member.id === updated.id ? updated : member))
    );
  };

  const syncBookingDurationFromServices = (
    lines: BookingServiceLine[],
    mode: 'custom' | 'catalog'
  ) => {
    const resolved = resolveBookingServices(lines, mode, services);
    setBookingDuration(resolved.duration || 60);
  };

  const updateBookingServices = (
    updater: (prev: BookingServiceLine[]) => BookingServiceLine[],
    mode: 'custom' | 'catalog' = bookingServiceMode
  ) => {
    setBookingServices((prev) => {
      const next = updater(prev);
      syncBookingDurationFromServices(next, mode);
      return next;
    });
  };

  const bookableStaff = useMemo(() => getBookableStaff(staffList), [staffList]);

  const getEligibleBookingStaff = (
    lines: BookingServiceLine[],
    mode: 'custom' | 'catalog',
    lockedStaffId?: string
  ) => {
    if (lockedStaffId) {
      return bookableStaff.filter((member) => member.id === lockedStaffId);
    }

    const catalogServiceIds =
      mode === 'catalog' ? lines.map((line) => line.serviceId).filter(Boolean) : [];

    const base =
      mode === 'custom' || catalogServiceIds.length === 0
        ? bookableStaff
        : getStaffForServiceIds(catalogServiceIds, bookableStaff);

    return base.filter((member) => member.status !== 'offline' || member.id === bookingStaffId);
  };

  // Open Appointment modal with dynamic context prefilled
  const closeAppointmentModal = () => {
    setIsAppointmentModalOpen(false);
    setBookingStaffLocked(false);
    setBookingServices([createBookingServiceLine(services)]);
    setBookingServiceMode('custom');
    setBookingStaffId('');
  };

  const handleOpenAppointmentModal = (
    clientName?: string, 
    defaultTime?: string, 
    prefilledServiceId?: string,
    defaultDate?: string,
    defaultStaffId?: string
  ) => {
    if (isManicuristaProfile) return;

    const lockedStaff = defaultStaffId
      ? bookableStaff.find((member) => member.id === defaultStaffId)
      : undefined;

    let defaultServiceId = prefilledServiceId || (services[0] ? services[0].id : '');

    if (lockedStaff && !prefilledServiceId) {
      const staffServices = getServicesForStaff(lockedStaff.id, services, staffList);
      if (staffServices.length > 0) {
        defaultServiceId = staffServices[0].id;
      }
    }

    const nextMode = prefilledServiceId || lockedStaff ? 'catalog' : 'custom';
    const initialServiceLine = createBookingServiceLine(services, defaultServiceId);

    setBookingClient(clientName || (clients[0] ? clients[0].name : ''));
    setBookingServiceMode(nextMode);
    setBookingServices([initialServiceLine]);
    setBookingStaffId(lockedStaff?.id ?? '');
    setBookingStaffLocked(Boolean(lockedStaff));
    setBookingTime(defaultTime || '10:00 AM');

    const selectedService = services.find((service) => service.id === defaultServiceId);
    setBookingDuration(selectedService?.duration ?? 60);

    const formatDateToSpanishShort = (date: Date) => formatSpanishShortDate(date);

    setBookingDate(defaultDate || formatDateToSpanishShort(new Date()));
    setBookingClientSearchMode(false);
    setBookingClientQuery('');
    setIsAppointmentModalOpen(true);
  };

  const handleGoToNewClientFromBooking = () => {
    closeAppointmentModal();
    setSelectedClientId(null);
    setCurrentTab('clients');
    setIsClientModalOpen(true);
    setMobileMenuOpen(false);
  };

  const bookingClientMatches = useMemo(() => {
    const query = bookingClientQuery.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query) ||
        client.phone.includes(query) ||
        client.id.toLowerCase().includes(query)
    );
  }, [clients, bookingClientQuery]);

  useEffect(() => {
    if (!isAppointmentModalOpen) return;

    setBookingClient((current) => {
      if (current && clients.some((client) => client.name === current)) {
        return current;
      }
      return clients[0]?.name || '';
    });
  }, [isAppointmentModalOpen, clients]);

  const bookingEligibleStaff = useMemo(
    () =>
      getEligibleBookingStaff(
        bookingServices,
        bookingServiceMode,
        bookingStaffLocked ? bookingStaffId : undefined
      ),
    [bookingServices, bookingServiceMode, bookingStaffLocked, bookingStaffId, bookableStaff]
  );

  // Submit appointment
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isManicuristaProfile) {
      window.alert('Las manicuristas no pueden agendar citas. Pide apoyo a recepción.');
      return;
    }

    if (!bookingClient.trim()) {
      window.alert('Selecciona un cliente para la cita.');
      return;
    }

    const clientObj = clients.find(c => c.name === bookingClient);
    if (!clientObj?.id) {
      window.alert('Selecciona un cliente válido o registra uno nuevo antes de reservar.');
      return;
    }

    const resolvedServices = resolveBookingServices(
      bookingServices,
      bookingServiceMode,
      services
    );

    if (!resolvedServices.isValid) {
      window.alert(
        bookingServiceMode === 'custom'
          ? 'Escribe todos los servicios requeridos o elige del catálogo.'
          : 'Selecciona un servicio válido del catálogo para cada línea.'
      );
      return;
    }

    const daySchedule = resolveScheduleForDateLabel(bookingDate, scheduleConfig);
    if (daySchedule.closed) {
      window.alert('El salón está cerrado en la fecha seleccionada.');
      return;
    }

    const staffObj = staffList.find(s => s.id === bookingStaffId);
    if (!staffObj?.id) {
      window.alert('Selecciona una manicurista para la cita.');
      return;
    }

    const appointmentDuration = bookingDuration || resolvedServices.duration;

    if (
      isStaffTimeBlocked(
        blockedSlots,
        bookingDate,
        bookingStaffId,
        bookingTime,
        appointmentDuration
      )
    ) {
      window.alert('Este horario está cerrado para la manicurista seleccionada.');
      return;
    }

    const conflictingAppointment = getConflictingAppointment(
      appointments,
      bookingDate,
      bookingStaffId,
      bookingTime,
      appointmentDuration
    );

    if (conflictingAppointment) {
      window.alert(
        `No se puede agendar: ${conflictingAppointment.clientName} ya tiene cita con ${staffObj.name} el ${conflictingAppointment.date} (${formatAppointmentTimeRange(conflictingAppointment.time, conflictingAppointment.duration)}). Elige otro horario o especialista.`
      );
      return;
    }

    const serviceName = resolvedServices.serviceName;
    const serviceSubtitle = resolvedServices.serviceSubtitle;
    const serviceImage = resolvedServices.serviceImage;
    const serviceCost = resolvedServices.cost;

    const nextStaffStats = {
      totalToday: staffObj.totalToday + 1,
      weeklyRevenue: staffObj.weeklyRevenue + serviceCost,
    };

    const visitsCount = clientObj.visitsCount + 1;
    const totalSpent = clientObj.totalSpent + serviceCost;
    const nextClientStats = {
      clientId: clientObj.id,
      visitsCount,
      totalSpent,
      averageTicket: totalSpent / visitsCount,
    };

    const activeReceptionist = getBookingReceptionist();
    const bookedOnDate = getTodaySpanishShortDate();

    if (!activeReceptionist) {
      window.alert('Debe haber una recepcionista activa para agendar citas.');
      return;
    }

    const nextReceptionistStats = {
      receptionistId: activeReceptionist.id,
      bookingsToday: activeReceptionist.bookingsToday + 1,
    };

    try {
      const created = await posApi.createAppointment({
        date: bookingDate,
        time: bookingTime,
        serviceName,
        serviceSubtitle,
        serviceImage,
        clientName: clientObj.name,
        clientId: clientObj.id,
        staffId: staffObj.id,
        staffName: staffObj.name,
        staffInitials: staffObj.id,
        cost: serviceCost,
        duration: appointmentDuration,
        status: 'agendado',
        bookedByReceptionistId: activeReceptionist.id,
        bookedByReceptionistName: activeReceptionist.name,
        bookedOnDate,
        staffStats: {
          staffId: staffObj.id,
          ...nextStaffStats,
        },
        clientStats: nextClientStats,
        receptionistStats: nextReceptionistStats,
      });

      setAppointments((prev) => [created, ...prev]);

      if (created.receptionists?.length) {
        setReceptionists(created.receptionists);
      } else if (activeReceptionist && nextReceptionistStats) {
        setReceptionists((prev) =>
          prev.map((member) =>
            member.id === activeReceptionist.id
              ? {
                  ...member,
                  bookingsToday: nextReceptionistStats.bookingsToday,
                  bookingsTodayDate: bookedOnDate,
                }
              : member
          )
        );
      }

      setStaffList((prev) =>
        prev.map((staff) =>
          staff.id === staffObj.id
            ? {
                ...staff,
                ...nextStaffStats,
              }
            : staff
        )
      );

      setClients((prev) =>
        prev.map((client) => {
          if (client.id !== clientObj.id) return client;

          return {
            ...client,
            visitsCount: nextClientStats.visitsCount,
            totalSpent: nextClientStats.totalSpent,
            averageTicket: nextClientStats.averageTicket,
          };
        })
      );

      await loadPosData({ silent: true });
      closeAppointmentModal();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : 'No se pudo guardar la cita en la base de datos.';
      window.alert(message);
    }
  };

  const handleDeleteAppointment = async (
    appointmentId: string,
    auth: ReceptionistAuthPayload
  ) => {
    if (isManicuristaProfile) return;

    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment) return;

    if (!canDeleteAppointment(appointment.status)) {
      throw new Error('No se puede eliminar una cita confirmada o terminada.');
    }

    // Eliminar = borrado permanente en MongoDB. No cambia el estatus a "cancelled".

    const staffObj = staffList.find((staff) => staff.id === appointment.staffId);
    const nextStaffStats = staffObj
      ? {
          staffId: staffObj.id,
          totalToday: Math.max(0, staffObj.totalToday - 1),
          completedToday:
            isAppointmentPaid(appointment.status)
              ? Math.max(0, staffObj.completedToday - 1)
              : staffObj.completedToday,
          weeklyRevenue: Math.max(0, staffObj.weeklyRevenue - appointment.cost),
        }
      : null;

    const clientObj = clients.find((client) => client.id === appointment.clientId);
    const nextClientStats = clientObj
      ? {
          clientId: clientObj.id,
          visitsCount: Math.max(0, clientObj.visitsCount - 1),
          totalSpent: Math.max(0, clientObj.totalSpent - appointment.cost),
          averageTicket: 0,
        }
      : null;

    if (nextClientStats && nextClientStats.visitsCount > 0) {
      nextClientStats.averageTicket =
        nextClientStats.totalSpent / nextClientStats.visitsCount;
    }

    const todayLabel = getTodaySpanishShortDate();
    const bookingReceptionist = appointment.bookedByReceptionistId
      ? receptionists.find((member) => member.id === appointment.bookedByReceptionistId)
      : null;
    const shouldAdjustReceptionCount =
      bookingReceptionist &&
      appointment.bookedOnDate === todayLabel;
    const nextReceptionistStats = shouldAdjustReceptionCount
      ? {
          receptionistId: bookingReceptionist.id,
          bookingsToday: Math.max(0, bookingReceptionist.bookingsToday - 1),
        }
      : null;

    try {
      await posApi.deleteAppointment(appointmentId, {
        staffStats: nextStaffStats,
        clientStats: nextClientStats,
        receptionistStats: nextReceptionistStats,
        receptionistId: auth.receptionistId,
        pin: auth.pin,
      });

      setAppointments((prev) => prev.filter((item) => item.id !== appointmentId));

      if (nextStaffStats) {
        setStaffList((prev) =>
          prev.map((staff) =>
            staff.id === nextStaffStats.staffId
              ? {
                  ...staff,
                  totalToday: nextStaffStats.totalToday,
                  completedToday: nextStaffStats.completedToday,
                  weeklyRevenue: nextStaffStats.weeklyRevenue,
                }
              : staff
          )
        );
      }

      setClients((prev) =>
        prev.map((client) => {
          if (!nextClientStats || client.id !== nextClientStats.clientId) return client;

          return {
            ...client,
            visitsCount: nextClientStats.visitsCount,
            totalSpent: nextClientStats.totalSpent,
            averageTicket: nextClientStats.averageTicket,
          };
        })
      );

      if (nextReceptionistStats) {
        setReceptionists((prev) =>
          prev.map((member) =>
            member.id === nextReceptionistStats.receptionistId
              ? {
                  ...member,
                  bookingsToday: nextReceptionistStats.bookingsToday,
                  bookingsTodayDate: todayLabel,
                }
              : member
          )
        );
      }

      await loadPosData({ silent: true });
    } catch (error) {
      console.error(error);
      throw error instanceof Error
        ? error
        : new Error('No se pudo eliminar la cita de la base de datos.');
    }
  };

  const handleCancelAppointment = async (
    appointmentId: string,
    auth: ReceptionistAuthPayload
  ) => {
    if (isManicuristaProfile) return;

    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment || appointment.status === 'cancelled') return;

    if (!canCancelAppointment(appointment.status)) {
      throw new Error('No se puede cancelar una cita confirmada o terminada.');
    }

    const staffObj = staffList.find((staff) => staff.id === appointment.staffId);
    const wasPaid = isAppointmentPaid(appointment.status);
    const nextCompletedToday = staffObj
      ? Math.max(
          0,
          staffObj.completedToday - (wasPaid ? 1 : 0)
        )
      : 0;

    try {
      await posApi.updateAppointment(appointmentId, {
        status: 'cancelled',
        receptionistId: auth.receptionistId,
        pin: auth.pin,
        staffStats: staffObj
          ? {
              staffId: staffObj.id,
              completedToday: nextCompletedToday,
            }
          : undefined,
      });

      setAppointments((prev) =>
        prev.map((item) =>
          item.id === appointmentId ? { ...item, status: 'cancelled' } : item
        )
      );

      if (staffObj) {
        setStaffList((prev) =>
          prev.map((staff) =>
            staff.id === staffObj.id
              ? { ...staff, completedToday: nextCompletedToday }
              : staff
          )
        );
      }

      await loadPosData({ silent: true });
    } catch (error) {
      console.error(error);
      throw error instanceof Error
        ? error
        : new Error('No se pudo cancelar la cita en la base de datos.');
    }
  };

  const handleEditAppointment = async (
    appointmentId: string,
    payload: AppointmentEditPayload
  ) => {
    if (isManicuristaProfile) return;

    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment) return;

    try {
      const updated = await posApi.updateAppointment(appointmentId, {
        serviceName: payload.serviceName,
        serviceSubtitle: payload.serviceSubtitle,
        date: payload.date,
        time: payload.time,
        duration: payload.duration,
        cost: payload.cost,
      });

      setAppointments((prev) =>
        prev.map((item) =>
          item.id === appointmentId ? { ...item, ...updated } : item
        )
      );

      await loadPosData({ silent: true });
    } catch (error) {
      console.error(error);
      throw error instanceof Error
        ? error
        : new Error('No se pudo actualizar la cita en la base de datos.');
    }
  };

  const handleUpdateAppointmentStatus = async (
    appointmentId: string,
    nextStatus: AppointmentStatus
  ) => {
    if (isManicuristaProfile) return;

    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment || appointment.status === nextStatus) return;

    if (isAppointmentLockedOnBoard(appointment.status) && appointment.status !== 'confirmado') {
      window.alert('No se puede modificar una cita terminada o cancelada.');
      return;
    }

    const expectedNext = getNextAppointmentStatus(appointment.status);
    if (expectedNext !== nextStatus) {
      window.alert('Solo se permite avanzar al siguiente estatus.');
      return;
    }

    const staffObj = staffList.find((staff) => staff.id === appointment.staffId);
    const wasPaid = isAppointmentPaid(appointment.status);
    const willBePaid = isAppointmentPaid(nextStatus);
    const nextCompletedToday = staffObj
      ? Math.max(
          0,
          staffObj.completedToday + (willBePaid && !wasPaid ? 1 : 0) - (!willBePaid && wasPaid ? 1 : 0)
        )
      : 0;

    try {
      await posApi.updateAppointment(appointmentId, {
        status: nextStatus,
        staffStats: staffObj
          ? {
              staffId: staffObj.id,
              completedToday: nextCompletedToday,
            }
          : undefined,
      });

      setAppointments((prev) =>
        prev.map((item) =>
          item.id === appointmentId ? { ...item, status: nextStatus } : item
        )
      );

      if (staffObj) {
        setStaffList((prev) =>
          prev.map((staff) =>
            staff.id === staffObj.id
              ? {
                  ...staff,
                  completedToday: nextCompletedToday,
                }
              : staff
          )
        );
      }

      await loadPosData({ silent: true });
    } catch (error) {
      console.error(error);
      window.alert('No se pudo actualizar el estatus de la cita.');
    }
  };

  const applyAdminStatusChange = async (
    appointmentId: string,
    nextStatus: AppointmentStatus
  ) => {
    if (!isMasterSession) {
      throw new Error('Solo el administrador puede realizar esta acción.');
    }

    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment || appointment.status === nextStatus) return;

    const staffObj = staffList.find((staff) => staff.id === appointment.staffId);
    const wasFinished = isAppointmentPaid(appointment.status);
    const willBeFinished = isAppointmentPaid(nextStatus);
    const nextCompletedToday = staffObj
      ? Math.max(
          0,
          staffObj.completedToday +
            (willBeFinished && !wasFinished ? 1 : 0) -
            (!willBeFinished && wasFinished ? 1 : 0)
        )
      : 0;

    await posApi.updateAppointment(appointmentId, {
      status: nextStatus,
      adminOverride: true,
      staffStats: staffObj
        ? {
            staffId: staffObj.id,
            completedToday: nextCompletedToday,
          }
        : undefined,
    });

    setAppointments((prev) =>
      prev.map((item) =>
        item.id === appointmentId ? { ...item, status: nextStatus } : item
      )
    );

    if (staffObj) {
      setStaffList((prev) =>
        prev.map((staff) =>
          staff.id === staffObj.id
            ? { ...staff, completedToday: nextCompletedToday }
            : staff
        )
      );
    }

    await loadPosData({ silent: true });
  };

  const handleAdminRevertAppointmentStatus = async (appointmentId: string) => {
    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment) throw new Error('Cita no encontrada.');

    const previous = getPreviousAppointmentStatus(appointment.status);
    if (!previous) throw new Error('Esta cita no se puede retroceder más.');

    await applyAdminStatusChange(appointmentId, previous);
  };

  const handleAdminCancelAppointment = async (appointmentId: string) => {
    await applyAdminStatusChange(appointmentId, 'cancelled');
  };

  const handleAdminDeleteAppointment = async (appointmentId: string) => {
    if (!isMasterSession) {
      throw new Error('Solo el administrador puede eliminar desde el dashboard.');
    }

    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment) throw new Error('Cita no encontrada.');

    const staffObj = staffList.find((staff) => staff.id === appointment.staffId);
    const nextStaffStats = staffObj
      ? {
          staffId: staffObj.id,
          totalToday: Math.max(0, staffObj.totalToday - 1),
          completedToday: isAppointmentPaid(appointment.status)
            ? Math.max(0, staffObj.completedToday - 1)
            : staffObj.completedToday,
          weeklyRevenue: Math.max(0, staffObj.weeklyRevenue - appointment.cost),
        }
      : null;

    const clientObj = clients.find((client) => client.id === appointment.clientId);
    const nextClientStats = clientObj
      ? {
          clientId: clientObj.id,
          visitsCount: Math.max(0, clientObj.visitsCount - 1),
          totalSpent: Math.max(0, clientObj.totalSpent - appointment.cost),
          averageTicket: 0,
        }
      : null;

    if (nextClientStats && nextClientStats.visitsCount > 0) {
      nextClientStats.averageTicket =
        nextClientStats.totalSpent / nextClientStats.visitsCount;
    }

    await posApi.deleteAppointment(appointmentId, {
      adminOverride: true,
      staffStats: nextStaffStats || undefined,
      clientStats: nextClientStats || undefined,
    });

    setAppointments((prev) => prev.filter((item) => item.id !== appointmentId));
    await loadPosData({ silent: true });
  };

  const handleCloseStaffSlot = async (slot: Omit<StaffBlockedSlot, 'id'>) => {
    if (isManicuristaProfile) return;

    if (isStaffTimeBlocked(blockedSlots, slot.date, slot.staffId, slot.time, slot.duration)) {
      window.alert('Ya existe un cierre en ese horario.');
      return;
    }

    const blockStart = parseTimeToMinutes(slot.time);
    const overlapsAppointment = appointments.some((appointment) => {
      if (appointment.date !== slot.date || appointment.staffId !== slot.staffId) {
        return false;
      }

      const appointmentStart = parseTimeToMinutes(appointment.time);
      if (blockStart < 0 || appointmentStart < 0) return false;

      return rangesOverlapMinutes(
        blockStart,
        slot.duration,
        appointmentStart,
        appointment.duration
      );
    });

    if (overlapsAppointment) {
      window.alert('No se puede cerrar: ya hay una cita en ese horario.');
      return;
    }

    try {
      const created = await posApi.createBlockedSlot(slot);
      setBlockedSlots((prev) => [...prev, created]);
    } catch (error) {
      console.error(error);
      window.alert('No se pudo cerrar el horario en la base de datos.');
    }
  };

  const handleRemoveBlockedSlot = async (blockedSlotId: string) => {
    if (isManicuristaProfile) return;

    try {
      await posApi.deleteBlockedSlot(blockedSlotId);
      setBlockedSlots((prev) => prev.filter((slot) => slot.id !== blockedSlotId));
    } catch (error) {
      console.error(error);
      window.alert('No se pudo abrir el horario en la base de datos.');
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const created = await posApi.createClient({
        name: newClientName,
        email: newClientEmail,
        phone: newClientPhone,
        birthday: newClientBirthday || 'No especificado',
        address: newClientAddress || 'No especificada',
        bio: newClientBio || 'Nueva clienta registrada en recepción.',
        styleProfile: {
          bio: 'Por definir en la primera visita.',
          tags: ['Nueva'],
        },
        alerts: newClientAlerts ? [newClientAlerts] : [],
      });

      setClients((prev) => [created, ...prev]);

      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientBirthday('');
      setNewClientAddress('');
      setNewClientBio('');
      setNewClientAlerts('');

      setIsClientModalOpen(false);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo registrar la clienta en la base de datos.';
      window.alert(message);
    }
  };

  const handleEditClient = async (clientId: string, payload: ClientEditPayload) => {
    try {
      const updated = await posApi.updateClient(clientId, payload);

      setClients((prev) =>
        prev.map((item) => (item.id === clientId ? { ...item, ...updated } : item))
      );

      if (payload.name) {
        setAppointments((prev) =>
          prev.map((item) =>
            item.clientId === clientId ? { ...item, clientName: updated.name } : item
          )
        );
      }

      await loadPosData({ silent: true });
    } catch (error) {
      console.error(error);
      throw error instanceof Error
        ? error
        : new Error('No se pudo actualizar la clienta en la base de datos.');
    }
  };

  // Submit staff recruitment
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    const staffInitials = newStaffName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const palette = STAFF_COLOR_PALETTE[staffList.length % STAFF_COLOR_PALETTE.length];

    try {
      const created = await posApi.createStaff({
        staffCode: staffInitials || 'ST',
        name: newStaffName,
        email: `${newStaffName.toLowerCase().replace(/ /g, '.')}@ae.studioo`,
        phone: '',
        role: newStaffRole,
        status: 'online',
        rating: 5.0,
        specialty: newStaffSpecialty || 'Tratamientos Generales',
        shift: newStaffShift,
        completedToday: 0,
        totalToday: 0,
        weeklyRevenue: 0,
        commissionPercent: 40,
        bio: newStaffBio || 'Artista apasionada dedicada a la estética ungueal.',
        image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
        color: palette.color,
        colorLight: palette.colorLight,
      });

      setStaffList((prev) => [...prev, created]);

      setNewStaffName('');
      setNewStaffSpecialty('');
      setNewStaffBio('');
      setIsStaffModalOpen(false);
    } catch (error) {
      console.error(error);
      window.alert('No se pudo dar de alta a la manicurista en la base de datos.');
    }
  };

  const handleDeleteStaff = (staffId: string) => {
    const staffMember = staffList.find((staff) => staff.id === staffId);
    if (!staffMember) return;

    setStaffDeactivateError(null);
    setStaffPendingDeactivation(staffMember);
  };

  const confirmDeactivateStaff = async () => {
    if (!staffPendingDeactivation) return;

    setIsDeactivatingStaff(true);
    setStaffDeactivateError(null);

    try {
      const result = await posApi.deleteStaff(staffPendingDeactivation.id);
      setStaffList((prev) =>
        prev.map((staff) =>
          staff.id === staffPendingDeactivation.id
            ? {
                ...staff,
                isActive: false,
                status: 'offline',
                deactivatedAt: result.deactivatedAt || new Date().toISOString(),
                deactivatedAgendaDate:
                  result.deactivatedAgendaDate || staff.deactivatedAgendaDate || '',
              }
            : staff
        )
      );

      if (selectedStaffId === staffPendingDeactivation.id) {
        setSelectedStaffId(null);
      }

      setStaffPendingDeactivation(null);

      if (result.hadAppointments) {
        window.alert(
          `${staffPendingDeactivation.name} fue dada de baja. En la agenda seguirá visible el día de la baja y los días anteriores; desde el día siguiente ya no aparecerá.`
        );
      }
    } catch (error) {
      console.error(error);
      setStaffDeactivateError(
        error instanceof Error
          ? error.message
          : 'No se pudo dar de baja a la manicurista en la base de datos.'
      );
    } finally {
      setIsDeactivatingStaff(false);
    }
  };

  // Render view router based on state variables
  const renderTabContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardView 
            staffList={staffList}
            clients={clients}
            appointments={appointments}
            services={services}
            canManageStatuses={isMasterSession}
            onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
            onAdminRevertAppointmentStatus={
              isMasterSession ? handleAdminRevertAppointmentStatus : undefined
            }
            onAdminCancelAppointment={
              isMasterSession ? handleAdminCancelAppointment : undefined
            }
            onAdminDeleteAppointment={
              isMasterSession ? handleAdminDeleteAppointment : undefined
            }
            onOpenCaja={() => setCurrentTab('caja')}
            onOpenNewAppointment={() => handleOpenAppointmentModal()}
            onOpenNewClient={() => setIsClientModalOpen(true)}
            onSelectClient={(id) => {
              setSelectedClientId(id);
              setCurrentTab('clients');
            }}
            onSelectStaff={(id) => {
              setSelectedStaffId(id);
              setCurrentTab('staff');
            }}
            scrollToSection={dashboardSection}
            scrollToken={dashboardScrollToken}
            scheduleConfig={scheduleConfig}
            onRefreshData={handleManualAgendaRefresh}
            isRefreshingData={isAgendaRefreshing}
          />
        );
      case 'agenda':
        return (
          <AgendaView 
            appointments={appointments}
            staffList={staffList}
            blockedSlots={blockedSlots}
            scheduleConfig={scheduleConfig}
            receptionists={receptionists}
            defaultReceptionistId={loggedInReceptionistId}
            readOnly={isManicuristaProfile}
            lockedStaffId={isManicuristaProfile ? loggedInStaffId : null}
            onOpenNewAppointment={(day, hour, staffId) =>
              handleOpenAppointmentModal(undefined, hour, undefined, day, staffId)
            }
            onSelectStaff={(id) => {
              if (isManicuristaProfile) return;
              setSelectedStaffId(id);
              setCurrentTab('staff');
            }}
            onDeleteAppointment={handleDeleteAppointment}
            onCancelAppointment={handleCancelAppointment}
            onEditAppointment={handleEditAppointment}
            onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
            onCloseStaffSlot={handleCloseStaffSlot}
            onRemoveBlockedSlot={handleRemoveBlockedSlot}
            services={services}
            ticketAppointmentIds={ticketAppointmentIds}
            onTicketSubmitted={async () => {
              await loadPosData({ silent: true });
            }}
            onRefreshAgenda={handleManualAgendaRefresh}
            isRefreshingAgenda={isAgendaRefreshing}
            loadedAgendaWeekKeys={loadedAgendaWeekKeys}
            onLoadAgendaWeek={handleLoadAgendaWeek}
            isLoadingAgendaWeek={isLoadingAgendaWeek}
          />
        );
      case 'caja':
        return (
          <CajaView
            appointments={appointments}
            todayLabel={getTodaySpanishShortDate()}
            receptionists={receptionists}
            loggedInReceptionist={
              receptionists.find((member) => member.id === loggedInReceptionistId) || null
            }
            isManicuristaSession={isManicuristaSession}
            isMasterSession={isMasterSession}
            loggedInStaffId={loggedInStaffId}
            services={services}
            staffList={staffList}
            onPaymentComplete={() => loadPosData({ silent: true })}
            onTicketSubmitted={async () => {
              await loadPosData({ silent: true });
            }}
            liveSyncAt={liveSyncAt}
            onRefreshAppointments={handleManualAgendaRefresh}
          />
        );
      case 'clients':
        if (selectedClientId) {
          const clientObj = clients.find(c => c.id === selectedClientId) || clients[0];
          return (
            <ClientProfileView 
              client={clientObj}
              appointments={appointments}
              onBack={() => setSelectedClientId(null)}
              onOpenNewAppointment={(name) => handleOpenAppointmentModal(name)}
              onEditClient={handleEditClient}
            />
          );
        }
        return (
          <ClientsView 
            clients={clients}
            onOpenNewClient={() => setIsClientModalOpen(true)}
            onSelectClient={(id) => setSelectedClientId(id)}
          />
        );
      case 'staff':
        if (isManicuristaSession && loggedInStaffId) {
          const ownStaff =
            staffList.find((member) => member.id === loggedInStaffId) || staffList[0];
          return (
            <StaffAnalyticsView
              staff={ownStaff}
              appointments={appointments}
              onBack={() => setSelectedStaffId(loggedInStaffId)}
              onStaffUpdated={handleStaffUpdated}
              readOnly
              hideBack
              onRefreshAppointments={handleManualAgendaRefresh}
              isRefreshingAppointments={isAgendaRefreshing}
            />
          );
        }
        if (selectedStaffId) {
          const staffObj = staffList.find(s => s.id === selectedStaffId) || staffList[0];
          return (
            <StaffAnalyticsView 
              staff={staffObj}
              appointments={appointments}
              onBack={() => setSelectedStaffId(null)}
              onStaffUpdated={handleStaffUpdated}
              isAccountantSession={isAccountantSession}
              loggedInAccountant={
                loggedInAccountantId
                  ? { id: loggedInAccountantId, name: loggedInAccountantName || 'Contadora' }
                  : null
              }
              onAccountantActivity={bumpAccountantActivity}
              activityRefreshKey={accountantActivityRefresh}
              showAccountantBitacora={isMasterSession && !isAccountantSession}
              onRefreshAppointments={handleManualAgendaRefresh}
              isRefreshingAppointments={isAgendaRefreshing}
            />
          );
        }
        return (
          <StaffView 
            staffList={staffList}
            appointments={appointments}
            receptionists={receptionists}
            onOpenNewStaff={() => setIsStaffModalOpen(true)}
            onSelectStaff={(id) => setSelectedStaffId(id)}
            onUpdateStaffStatus={handleUpdateStaffStatus}
            onDeleteStaff={handleDeleteStaff}
            readOnly={isAccountantSession}
            showAccountantBitacora={isMasterSession && !isAccountantSession}
            showAccountantDiscounts={isAccountantSession}
            showReceptionistCodes={isMasterSession && !isAccountantSession}
            activityRefreshKey={accountantActivityRefresh}
          />
        );
      case 'services':
        return (
          <ServicesView 
            services={services}
            onOpenNewAppointment={(clientName, time, serviceId) => 
              handleOpenAppointmentModal(clientName, time, serviceId)
            }
          />
        );
      case 'inventario':
        return <InventarioView />;
      case 'settings':
        return (
          <SettingsView
            scheduleConfig={scheduleConfig}
            onScheduleConfigUpdated={setScheduleConfig}
            isMasterSession={isMasterSession}
          />
        );
      case 'admin-precios':
        return isMasterSession ? <AdminPreciosView /> : null;
      case 'admin-gastos':
        return (
          <AdminGastosView
            isAccountantSession={isAccountantSession}
            isMasterSession={isMasterSession}
          />
        );
      case 'admin-proveedores':
        return <AdminProveedoresView />;
      case 'admin-compras':
        return <AdminComprasView />;
      case 'admin-cuentas-pagar':
        return <AdminCuentasPagarView />;
      case 'master-log':
        return (
          <MasterReceptionLogView
            appointments={appointments}
            receptionists={receptionists}
            onBack={() => setCurrentTab('dashboard')}
          />
        );
      default:
        return <DashboardView 
          staffList={staffList}
          clients={clients}
          appointments={appointments}
          services={services}
          canManageStatuses={isMasterSession}
          onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
          onAdminRevertAppointmentStatus={
            isMasterSession ? handleAdminRevertAppointmentStatus : undefined
          }
          onAdminCancelAppointment={
            isMasterSession ? handleAdminCancelAppointment : undefined
          }
          onAdminDeleteAppointment={
            isMasterSession ? handleAdminDeleteAppointment : undefined
          }
          onOpenCaja={() => setCurrentTab('caja')}
          onOpenNewAppointment={() => handleOpenAppointmentModal()}
          onOpenNewClient={() => setIsClientModalOpen(true)}
          onSelectClient={(id) => {
            setSelectedClientId(id);
            setCurrentTab('clients');
          }}
          onSelectStaff={(id) => {
            setSelectedStaffId(id);
            setCurrentTab('staff');
          }}
          scrollToSection={dashboardSection}
          scrollToken={dashboardScrollToken}
          scheduleConfig={scheduleConfig}
        />;
    }
  };

  if (!sessionReady) {
    return (
      <div className="pos-theme fixed inset-0 bg-[#00261b] z-[9999] flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-[#e5c158]" />
      </div>
    );
  }

  if (!isSessionValidated) {
    return <LoginView onLogin={handleLocalLogin} />;
  }

  return (
    <div className="pos-theme flex flex-col bg-background min-h-[100dvh] h-[100dvh] overflow-hidden text-on-surface">
      {(isDataLoading || dbWarning) && (
        <div
          className={`shrink-0 px-4 py-2 text-center text-xs font-sans font-bold ${
            dbWarning
              ? 'bg-amber-100 text-amber-900 border-b border-amber-200'
              : 'bg-primary/5 text-primary border-b border-primary/10'
          }`}
        >
          {dbWarning || 'Sincronizando con la base de datos...'}
          {dbWarning && (
            <button
              type="button"
              onClick={() => loadPosData()}
              className="ml-3 underline uppercase tracking-wider"
            >
              Reintentar
            </button>
          )}
        </div>
      )}
      {loggedInReceptionist && (
        <div className="shrink-0 px-4 py-2 bg-secondary/10 border-b border-secondary/20 text-center">
          <p className="text-xs font-sans font-bold text-primary">
            Turno abierto por{' '}
            <span className="text-secondary uppercase tracking-wider">{loggedInReceptionist.name}</span>
            <span className="text-outline font-medium normal-case tracking-normal">
              {' '}· {loggedInReceptionist.bookingsToday} citas agendadas hoy
            </span>
          </p>
        </div>
      )}
      {loggedInAccountantName && (
        <div className="shrink-0 px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-center">
          <p className="text-xs font-sans font-bold text-primary">
            Sesión de contabilidad ·{' '}
            <span className="text-emerald-800 uppercase tracking-wider">{loggedInAccountantName}</span>
            <span className="text-outline font-medium normal-case tracking-normal">
              {' '}· Equipo y administración
            </span>
          </p>
        </div>
      )}
      {loggedInStaffMember && isManicuristaSession && (
        <div className="shrink-0 px-4 py-2 bg-sky-500/10 border-b border-sky-500/20 text-center">
          <p className="text-xs font-sans font-bold text-primary">
            Sesión de{' '}
            <span className="text-sky-800 uppercase tracking-wider">{loggedInStaffMember.name}</span>
            <span className="text-outline font-medium normal-case tracking-normal">
              {' '}· Agenda y perfil en solo consulta
            </span>
          </p>
        </div>
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* 1. Desktop Persistent Left Sidebar Navigation */}
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={(tab) => {
          if (isAccountantSession && !ACCOUNTANT_TAB_IDS.includes(tab)) return;
          if (isManicuristaSession && !MANICURISTA_TAB_IDS.includes(tab)) return;
          if (isPlainReceptionSession && !RECEPTIONIST_TAB_IDS.includes(tab)) return;
          setCurrentTab(tab);
          setSelectedClientId(null);
          if (isManicuristaSession && loggedInStaffId) {
            setSelectedStaffId(loggedInStaffId);
          } else {
            setSelectedStaffId(null);
          }
        }} 
        activeSession={activeSession}
        onLogout={handlePosLogout}
        isMasterSession={isMasterSession}
        onOpenMasterPanel={() => setCurrentTab('master-log')}
        allowedTabIds={allowedTabIds}
        adminNavItems={adminNavItems}
        activeDashboardSection={dashboardSection}
        onDashboardSection={(sectionId) => {
          if (isAccountantSession && !ACCOUNTANT_TAB_IDS.includes('dashboard')) return;
          if (isManicuristaSession && !MANICURISTA_TAB_IDS.includes('dashboard')) return;
          if (isPlainReceptionSession && !RECEPTIONIST_TAB_IDS.includes('dashboard')) return;
          setCurrentTab('dashboard');
          setDashboardSection(sectionId);
          setDashboardScrollToken((prev) => prev + 1);
          setSelectedClientId(null);
          if (isManicuristaSession && loggedInStaffId) {
            setSelectedStaffId(loggedInStaffId);
          } else {
            setSelectedStaffId(null);
          }
        }}
      />

      {/* 2. Main content scrollable canvas shell */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        
        {/* Compact header (phones only — tablets/desktop use the sidebar) */}
        <header className="hidden h-16 border-b border-primary/10 px-6 items-center justify-between shrink-0 bg-surface">
          <div
            className="flex flex-col min-w-0 select-none"
            onClick={() => {
              if (isMasterSession) {
                setMobileLogoClicks((prev) => prev + 1);
              }
            }}
          >
            <StudioLogo size="sm" showWordmark />
            {loggedInReceptionist && (
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider truncate mt-0.5">
                {isMasterSession
                  ? 'Administrador'
                  : `${loggedInReceptionist.name} · ${receptionSessionLabel}`}
              </p>
            )}
            {loggedInAccountantName && (
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider truncate mt-0.5">
                {loggedInAccountantName} · Contabilidad
              </p>
            )}
            {loggedInStaffMember && isManicuristaSession && (
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider truncate mt-0.5">
                {loggedInStaffMember.name} · Manicurista
              </p>
            )}
          </div>
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-1 text-primary"
            title="Abrir menú"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Dynamic Inner Panel Renders */}
        <main className="flex-grow overflow-y-auto min-w-0 px-2 sm:px-3 lg:px-8 py-3 lg:py-8">
          {renderTabContent()}
        </main>
      </div>

      {/* 3. Mobile Navigation Menu Drawer overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 justify-end animate-fade-in hidden">
          <div className="w-64 h-full bg-surface p-6 flex flex-col justify-between border-l border-primary/10 relative">
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-1 text-primary"
              title="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-8 mt-8">
              <div className="pb-4 border-b border-primary/5">
                <StudioLogo size="sm" showWordmark />
              </div>

              <nav className="space-y-3">
                {[
                  { id: 'dashboard', label: 'Dashboard' },
                  { id: 'agenda', label: 'Agenda Semanal' },
                  { id: 'caja', label: 'Caja / Cobros' },
                  { id: 'clients', label: 'Clientes CRM' },
                  { id: 'staff', label: 'Equipo' },
                  { id: 'services', label: 'Servicios' },
                  { id: 'inventario', label: 'Inventario Manicura' },
                  { id: 'settings', label: 'Configuración' }
                ]
                  .filter((item) =>
                    allowedTabIds ? allowedTabIds.includes(item.id) : true
                  )
                  .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentTab(item.id);
                      setSelectedClientId(null);
                      if (isManicuristaSession && loggedInStaffId) {
                        setSelectedStaffId(loggedInStaffId);
                      } else {
                        setSelectedStaffId(null);
                      }
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg font-sans text-xs tracking-wider uppercase font-bold transition-colors ${
                      currentTab === item.id 
                        ? 'bg-primary/5 text-primary border-l-2 border-secondary' 
                        : 'text-outline hover:text-primary'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                {adminNavItems.length > 0 ? (
                  <div className="pt-2 border-t border-primary/5">
                    <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-secondary">
                      Administración
                    </p>
                    {adminNavItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentTab(item.id);
                          setSelectedClientId(null);
                          setSelectedStaffId(null);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg font-sans text-xs tracking-wider uppercase font-bold transition-colors ${
                          currentTab === item.id
                            ? 'bg-primary/5 text-primary border-l-2 border-secondary'
                            : 'text-outline hover:text-primary'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </nav>
            </div>

            {/* Quick access in Mobile too */}
            <div className="border-t border-primary/5 pt-4 space-y-3">
              {loggedInReceptionist && (
                <div className="px-2">
                  <p className="text-xs font-bold text-primary uppercase">
                    {isMasterSession ? 'Administrador' : loggedInReceptionist.name}
                  </p>
                  <p className="text-[10px] text-outline">
                    {receptionSessionLabel}
                  </p>
                </div>
              )}
              {loggedInAccountantName && (
                <div className="px-2">
                  <p className="text-xs font-bold text-primary uppercase">{loggedInAccountantName}</p>
                  <p className="text-[10px] text-outline">Contabilidad · Equipo y administración</p>
                </div>
              )}
              <button
                type="button"
                onClick={handlePosLogout}
                className="w-full px-4 py-2 rounded-lg border border-primary/10 text-xs font-bold uppercase tracking-wider text-outline hover:text-primary"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================
          MODAL OVERLAYS: NEW APPOINTMENT BOOKING 
          ============================================== */}
      {isAppointmentModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest max-w-lg w-full max-h-[min(92dvh,920px)] rounded-2xl border border-primary/5 luxury-shadow overflow-hidden relative flex flex-col">
            <button 
              onClick={closeAppointmentModal}
              className="absolute top-4 right-4 z-10 text-outline hover:text-primary transition-colors"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="shrink-0 px-6 pt-6 pb-3 pr-12">
            <span className="text-secondary font-sans text-[10px] font-extrabold uppercase tracking-widest block mb-1">Cuidado Estético</span>
            <h3 className="font-display text-xl font-bold text-primary mb-2">Reservar Nueva Cita</h3>
            {bookingStaffLocked && (() => {
              const lockedStaff = staffList.find((member) => member.id === bookingStaffId);
              if (!lockedStaff) return null;
              return (
                <div
                  className="mb-1 flex items-center gap-2 rounded-xl border px-3 py-2.5"
                  style={{
                    backgroundColor: lockedStaff.colorLight,
                    borderColor: `${lockedStaff.color}40`
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: lockedStaff.color }}
                  />
                  <p className="text-xs font-sans font-bold text-primary leading-snug">
                    Columna de <span style={{ color: lockedStaff.color }}>{lockedStaff.name}</span>
                    {bookingTime ? ` · ${bookingTime}` : ''}
                    <span className="block text-[10px] font-medium text-on-surface-variant mt-0.5">
                      La cita se agendará con esta especialista.
                    </span>
                  </p>
                </div>
              );
            })()}
            </div>

            <form onSubmit={handleCreateAppointment} className="flex flex-col min-h-0 flex-1">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-2 space-y-4">
              {/* Select Client */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGoToNewClientFromBooking}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-primary/10 bg-surface text-[10px] font-sans font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Nuevo cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingClientSearchMode((prev) => {
                        const next = !prev;
                        if (next) {
                          setBookingClientQuery(bookingClient);
                        } else {
                          setBookingClientQuery('');
                        }
                        return next;
                      });
                    }}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[10px] font-sans font-bold uppercase tracking-wider transition-colors ${
                      bookingClientSearchMode
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-primary/10 bg-surface text-primary hover:bg-surface-container-low'
                    }`}
                  >
                    <Search className="w-3.5 h-3.5" />
                    Buscar cliente
                  </button>
                </div>

                <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Seleccionar clienta</label>

                {clients.length === 0 ? (
                  <p className="text-xs text-outline px-1 py-2">
                    No hay clientas cargadas. Usa «Nuevo cliente» o recarga la página.
                  </p>
                ) : bookingClientSearchMode ? (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline pointer-events-none" />
                      <input
                        type="text"
                        value={bookingClientQuery}
                        onChange={(e) => setBookingClientQuery(e.target.value)}
                        placeholder="Nombre, teléfono, correo o ID..."
                        className="w-full pl-9 pr-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto rounded-lg border border-primary/10 bg-surface divide-y divide-primary/5">
                      {bookingClientMatches.length === 0 ? (
                        <p className="px-3 py-2 text-[10px] text-outline">Sin resultados</p>
                      ) : (
                        bookingClientMatches.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => {
                              setBookingClient(client.name);
                              setBookingClientQuery(client.name);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs font-sans transition-colors ${
                              bookingClient === client.name
                                ? 'bg-primary/10 text-primary font-bold'
                                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
                            }`}
                          >
                            <span className="font-bold block">{client.name}</span>
                            <span className="text-[10px] text-outline">
                              {client.phone || client.email || client.id}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    {bookingClient && (
                      <p className="text-[10px] text-outline">
                        Seleccionado: <span className="font-bold text-primary">{bookingClient}</span>
                      </p>
                    )}
                    <input type="hidden" value={bookingClient} required />
                  </div>
                ) : (
                  <select 
                    value={bookingClient}
                    onChange={(e) => setBookingClient(e.target.value)}
                    className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                    required
                  >
                    <option value="" disabled>
                      Elige una clienta...
                    </option>
                    {clients.map(c => (
                      <option key={c.id} value={c.name}>{c.name} · {c.id}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Select Service */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                    Servicio / Tratamiento
                  </label>
                  <div className="flex items-center gap-1 bg-surface-container-low rounded-lg p-0.5 border border-primary/5">
                    <button
                      type="button"
                      onClick={() => {
                        setBookingServiceMode('custom');
                        syncBookingDurationFromServices(bookingServices, 'custom');
                      }}
                      className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-colors ${
                        bookingServiceMode === 'custom'
                          ? 'bg-primary text-on-primary'
                          : 'text-outline hover:text-primary'
                      }`}
                    >
                      Escribir
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBookingServiceMode('catalog');
                        updateBookingServices(
                          (prev) =>
                            prev.map((line) => ({
                              ...line,
                              serviceId:
                                line.serviceId ||
                                services.find((service) => service.id === line.serviceId)?.id ||
                                services[0]?.id ||
                                '',
                            })),
                          'catalog'
                        );
                      }}
                      className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-colors ${
                        bookingServiceMode === 'catalog'
                          ? 'bg-primary text-on-primary'
                          : 'text-outline hover:text-primary'
                      }`}
                    >
                      Catálogo
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {bookingServices.map((line, index) => {
                    const isLastLine = index === bookingServices.length - 1;

                    return (
                    <div key={line.key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      {bookingServiceMode === 'custom' ? (
                        <input
                          type="text"
                          value={line.customName}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateBookingServices(
                              (prev) =>
                                prev.map((item) =>
                                  item.key === line.key ? { ...item, customName: value } : item
                                ),
                              'custom'
                            );
                          }}
                          placeholder={
                            index === 0
                              ? 'Escribe el servicio requerido (ej. Uñas acrílicas con diseño)'
                              : 'Otro servicio...'
                          }
                          className="flex-1 px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                          autoFocus={index === 0}
                          required
                        />
                      ) : (
                        <select
                          value={line.serviceId}
                          onChange={(e) => {
                            const nextServiceId = e.target.value;
                            const nextCatalog = services.find((s) => s.id === nextServiceId);
                            const isPerNail = nextCatalog?.pricingMode === 'per_nail';
                            updateBookingServices(
                              (prev) =>
                                prev.map((item) =>
                                  item.key === line.key
                                    ? {
                                        ...item,
                                        serviceId: nextServiceId,
                                        quantity: isPerNail ? 10 : 1,
                                        nailScope: isPerNail ? 'manos' : '',
                                      }
                                    : item
                                ),
                              'catalog'
                            );

                            if (!bookingStaffLocked && bookingStaffId) {
                              const nextLines = bookingServices.map((item) =>
                                item.key === line.key
                                  ? { ...item, serviceId: nextServiceId }
                                  : item
                              );
                              const eligible = getStaffForServiceIds(
                                nextLines.map((item) => item.serviceId).filter(Boolean),
                                bookableStaff
                              ).filter((member) => member.status !== 'offline');

                              if (!eligible.some((member) => member.id === bookingStaffId)) {
                                setBookingStaffId('');
                              }
                            }
                          }}
                          className="flex-1 px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                          required
                        >
                          {(bookingStaffLocked
                            ? getServicesForStaff(bookingStaffId, services, staffList)
                            : services
                          ).map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.name} — {formatServicePrice(service.price)}
                              {service.pricingMode === 'per_nail' ? '/uña' : ''}
                            </option>
                          ))}
                        </select>
                      )}

                      {bookingServices.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            updateBookingServices(
                              (prev) => prev.filter((item) => item.key !== line.key),
                              bookingServiceMode
                            );
                          }}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-primary/10 text-outline hover:text-primary hover:bg-surface-container-low transition-colors shrink-0"
                          title="Quitar servicio"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      )}

                      {isLastLine && (
                        <button
                          type="button"
                          onClick={() => {
                            updateBookingServices(
                              (prev) => [
                                ...prev,
                                createBookingServiceLine(
                                  services,
                                  bookingServices[bookingServices.length - 1]?.serviceId ||
                                    services[0]?.id
                                ),
                              ],
                              bookingServiceMode
                            );
                          }}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border-2 border-primary bg-primary text-on-primary hover:opacity-90 transition-opacity shrink-0 shadow-sm"
                          title="Agregar otro servicio"
                          aria-label="Agregar otro servicio"
                        >
                          <Plus className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                      )}
                    </div>

                      {bookingServiceMode === 'catalog' &&
                        (() => {
                          const catalog = services.find((s) => s.id === line.serviceId);
                          if (catalog?.pricingMode !== 'per_nail') return null;
                          const nailMax = catalog.nailMax || 20;
                          return (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  updateBookingServices(
                                    (prev) =>
                                      prev.map((item) =>
                                        item.key === line.key
                                          ? { ...item, quantity: 10, nailScope: 'manos' }
                                          : item
                                      ),
                                    'catalog'
                                  )
                                }
                                className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                                  line.nailScope === 'manos'
                                    ? 'bg-primary text-on-primary border-primary'
                                    : 'border-primary/10 text-outline'
                                }`}
                              >
                                Manos ×10
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateBookingServices(
                                    (prev) =>
                                      prev.map((item) =>
                                        item.key === line.key
                                          ? {
                                              ...item,
                                              quantity: 20,
                                              nailScope: 'manos_pies',
                                            }
                                          : item
                                      ),
                                    'catalog'
                                  )
                                }
                                className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                                  line.nailScope === 'manos_pies'
                                    ? 'bg-primary text-on-primary border-primary'
                                    : 'border-primary/10 text-outline'
                                }`}
                              >
                                Manos+pies ×20
                              </button>
                              <select
                                value={line.quantity || 1}
                                onChange={(e) =>
                                  updateBookingServices(
                                    (prev) =>
                                      prev.map((item) =>
                                        item.key === line.key
                                          ? {
                                              ...item,
                                              quantity: Number(e.target.value) || 1,
                                            }
                                          : item
                                      ),
                                    'catalog'
                                  )
                                }
                                className="px-2 py-1 rounded-md border border-primary/10 text-[10px] font-bold text-primary bg-surface"
                              >
                                {Array.from({ length: nailMax }, (_, i) => i + 1).map((n) => (
                                  <option key={n} value={n}>
                                    ×{n} = {formatServicePrice((catalog.price || 0) * n)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })()}
                    </div>
                    );
                  })}
                </div>

                {bookingServices.length > 1 && (
                  <p className="text-[9px] text-outline">
                    {bookingServices.length} servicios en esta cita. La duración y el costo se suman automáticamente.
                  </p>
                )}
              </div>

              {/* Select Staff Specialist */}
              <div className="space-y-1">
                <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                  Especialista / Artista Asignado
                  {bookingStaffLocked ? ' (fijada desde la agenda)' : ''}
                </label>
                <select 
                  value={bookingStaffId}
                  onChange={(e) => setBookingStaffId(e.target.value)}
                  disabled={bookingStaffLocked}
                  className={`w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary ${
                    bookingStaffLocked ? 'opacity-80 cursor-not-allowed' : ''
                  } ${!bookingStaffId && !bookingStaffLocked ? 'text-outline' : ''}`}
                  required
                >
                  {!bookingStaffLocked && (
                    <option value="">Seleccionar manicurista...</option>
                  )}
                  {bookingEligibleStaff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} — {member.role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date, time and duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Fecha</label>
                  <input 
                    type="text" 
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    placeholder="e.g. 1 Jul, 2026"
                    className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Hora de la Cita</label>
                  <select
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    disabled={bookingDaySchedule.closed}
                    className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary disabled:opacity-50"
                    required
                  >
                    {bookingTimeOptions.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Duración</label>
                  <select
                    value={bookingDuration}
                    onChange={(e) => setBookingDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                    required
                  >
                    {getDurationOptionsFromConfig(
                      bookingDayConfig,
                      resolveBookingServices(bookingServices, bookingServiceMode, services).duration
                    ).map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {formatDuration(minutes)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className={`text-[9px] -mt-2 ${
                bookingDaySchedule.closed ? 'text-red-600 font-bold' : 'text-outline'
              }`}>
                {bookingDaySchedule.closed
                  ? 'El salón está cerrado en esta fecha. Elige otro día para agendar.'
                  : `Horario del día: ${bookingDaySchedule.hoursLabel}. La duración se ajusta según el servicio; puedes modificarla si hace falta.`}
              </p>
              </div>

              {/* Confirm Actions */}
              <div className="shrink-0 px-6 py-4 flex items-center justify-end gap-3 border-t border-primary/5 bg-surface-container-lowest">
                <button 
                  type="button" 
                  onClick={closeAppointmentModal}
                  className="px-4 py-2 border border-primary/10 text-outline hover:text-primary rounded-lg text-xs font-sans font-bold uppercase tracking-wider transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-sans text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Confirmar Reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {staffPendingDeactivation && (
        <StaffDeactivateModal
          staff={staffPendingDeactivation}
          isSubmitting={isDeactivatingStaff}
          error={staffDeactivateError}
          onConfirm={confirmDeactivateStaff}
          onClose={() => {
            if (isDeactivatingStaff) return;
            setStaffPendingDeactivation(null);
            setStaffDeactivateError(null);
          }}
        />
      )}

      {/* ==============================================
          MODAL OVERLAYS: REGISTER NEW CLIENT VIP
          ============================================== */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest max-w-lg w-full max-h-[min(92dvh,920px)] rounded-2xl border border-primary/5 luxury-shadow overflow-hidden relative flex flex-col">
            <button 
              onClick={() => setIsClientModalOpen(false)}
              className="absolute top-4 right-4 z-10 text-outline hover:text-primary transition-colors"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="shrink-0 px-6 pt-6 pb-3 pr-12">
            <span className="text-secondary font-sans text-[10px] font-extrabold uppercase tracking-widest block mb-1">Registro de Clientes</span>
            <h3 className="font-display text-xl font-bold text-primary mb-2">Registrar Cliente en studio aé</h3>
            <p className="text-xs text-outline">
              El ID se genera automáticamente (SA-1001, SA-1002…). El teléfono evita registros duplicados.
            </p>
            </div>

            <form onSubmit={handleCreateClient} className="flex flex-col min-h-0 flex-1">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-2 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Nombre Completo</label>
                <input 
                  type="text" 
                  placeholder="e.g. Maria Antonieta"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Correo Electrónico</label>
                  <input 
                    type="email" 
                    placeholder="e.g. maria@email.com"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Teléfono (10 dígitos) *</label>
                  <input 
                    type="tel" 
                    placeholder="e.g. 5512345678"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                    required
                    minLength={10}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Fecha de Nacimiento</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 14 de Abril, 1990"
                    value={newClientBirthday}
                    onChange={(e) => setNewClientBirthday(e.target.value)}
                    className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Ubicación / Ciudad</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Madrid, España"
                    value={newClientAddress}
                    onChange={(e) => setNewClientAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Biografía Ejecutiva / Historial Estético</label>
                <textarea 
                  placeholder="Introduce características del cliente, su puntualidad o preferencias..."
                  value={newClientBio}
                  onChange={(e) => setNewClientBio(e.target.value)}
                  className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary h-20 resize-none"
                />
              </div>

              {/* Alert note input */}
              <div className="space-y-1">
                <label className="text-[10px] text-amber-800 font-bold uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Contraindicación o Alergia Médica (Opcional)
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Sensibilidad extrema a acetona pura"
                  value={newClientAlerts}
                  onChange={(e) => setNewClientAlerts(e.target.value)}
                  className="w-full px-3 py-2 border border-amber-200 rounded-lg text-xs font-sans font-bold text-amber-900 bg-amber-50/20 outline-none focus:border-amber-600"
                />
              </div>
              </div>

              {/* Confirm Actions */}
              <div className="shrink-0 px-6 py-4 flex items-center justify-end gap-3 border-t border-primary/5 bg-surface-container-lowest">
                <button 
                  type="button" 
                  onClick={() => setIsClientModalOpen(false)}
                  className="px-4 py-2 border border-primary/10 text-outline hover:text-primary rounded-lg text-xs font-sans font-bold uppercase tracking-wider transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-sans text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Registrar VIP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================
          MODAL OVERLAYS: CONTRACT/ADD NEW STAFF
          ============================================== */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-2xl border border-primary/5 luxury-shadow overflow-hidden p-6 relative">
            <button 
              onClick={() => setIsStaffModalOpen(false)}
              className="absolute top-4 right-4 text-outline hover:text-primary transition-colors"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-secondary font-sans text-[10px] font-extrabold uppercase tracking-widest block mb-1">Contrataciones</span>
            <h3 className="font-display text-xl font-bold text-primary mb-5">Agregar Nuevo Staff</h3>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Nombre del Especialista</label>
                <input 
                  type="text" 
                  placeholder="e.g. Carla"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Rol / Rango</label>
                  <select 
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value)}
                    className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                  >
                    <option value="Perfil más completo">Perfil más completo</option>
                    <option value="Generalista en crecimiento">Generalista en crecimiento</option>
                    <option value="Especialista 100% uñas">Especialista 100% uñas</option>
                    <option value="Uñas + mirada y cejas">Uñas + mirada y cejas</option>
                    <option value="Estética">Estética</option>
                    <option value="Comodín de uñas">Comodín de uñas</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Turno Asignado</label>
                  <select 
                    value={newStaffShift}
                    onChange={(e) => setNewStaffShift(e.target.value)}
                    className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                  >
                    <option value="Completo">Completo</option>
                    <option value="Mañana (09:00 - 15:00)">Mañana (09:00 - 15:00)</option>
                    <option value="Tarde (15:00 - 21:00)">Tarde (15:00 - 21:00)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Especialidad Técnica</label>
                <input 
                  type="text" 
                  placeholder="e.g. Nail Art Estilo Asiático o Esculpidas Acrílicas"
                  value={newStaffSpecialty}
                  onChange={(e) => setNewStaffSpecialty(e.target.value)}
                  className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">Breve Biografía / Filosofía de Trabajo</label>
                <textarea 
                  placeholder="Introduce detalles sobre sus técnicas, su experiencia previa..."
                  value={newStaffBio}
                  onChange={(e) => setNewStaffBio(e.target.value)}
                  className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary h-24 resize-none"
                />
              </div>

              {/* Confirm Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-primary/5 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-4 py-2 border border-primary/10 text-outline hover:text-primary rounded-lg text-xs font-sans font-bold uppercase tracking-wider transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-sans text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Contratar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
