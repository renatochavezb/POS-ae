export interface StyleProfile {
  bio: string;
  tags: string[];
}

export interface Client {
  id: string; // e.g. "SA-4092"
  name: string;
  email: string;
  phone: string;
  birthday: string;
  address: string;
  isPlatinum: boolean;
  memberSince: string;
  bio: string;
  styleProfile: StyleProfile;
  alerts: string[];
  totalSpent: number;
  visitsCount: number;
  averageTicket: number;
  registeredAt?: string;
  lastPaidVisitDate?: string;
  crmSegmentFlags?: ClientCrmSegmentFlags;
  crmSegmentDetails?: Partial<Record<keyof ClientCrmSegmentFlags, string>>;
  crmSegmentsSyncedAt?: string;
}

export interface ClientCrmSegmentFlags {
  inactive: boolean;
  upcoming: boolean;
  unconfirmed: boolean;
  nuevas: boolean;
  birthday: boolean;
  alerts: boolean;
  reschedule: boolean;
}

export type StaffStatus = 'online' | 'offline' | 'break';

export interface Staff {
  id: string; // iniciales como "CA", "DI"
  name: string;
  email: string;
  phone: string;
  role: string;
  status: StaffStatus;
  rating: number;
  specialty: string;
  shift: string;
  completedToday: number;
  totalToday: number;
  weeklyRevenue: number;
  commissionPercent: number; // e.g. 40
  bio: string;
  image: string;
  color: string;
  colorLight: string;
  allowedServiceIds?: string[];
  isActive?: boolean;
  deactivatedAt?: string;
  deactivatedAgendaDate?: string;
}

export interface Receptionist {
  id: string;
  name: string;
  role: string;
  loginCode: string;
  bookingsToday: number;
  bookingsTodayDate?: string;
  image: string;
  color: string;
  colorLight: string;
}

export interface Accountant {
  id: string;
  name: string;
  role: string;
  loginCode?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
}

export interface StaffSettlementAppointmentSnapshot {
  appointmentCode: string;
  date: string;
  time: string;
  clientName: string;
  serviceName: string;
  cost: number;
  commissionAmount: number;
  status: string;
}

export interface StaffSettlement {
  id: string;
  staffId: string;
  staffName: string;
  periodMode: 'day' | 'period';
  periodStartLabel: string;
  periodEndLabel: string;
  periodStartYmd: string;
  periodEndYmd: string;
  settledAt: string;
  settledDateLabel: string;
  grossAmount: number;
  commissionAmount: number;
  paidAmount: number;
  commissionPercent: number;
  appointmentCount: number;
  accountantId: string;
  accountantName: string;
  notes?: string;
  appointmentCodes?: string[];
  appointmentSnapshots?: StaffSettlementAppointmentSnapshot[];
  paymentCodes?: string[];
  cashSessionCodes?: string[];
  loginAuditId?: string;
}

export type AccountantActivityAction =
  | 'login'
  | 'logout'
  | 'report_download'
  | 'liquidation';

export interface AccountantActivity {
  id: string;
  accountantId: string;
  accountantName: string;
  action: AccountantActivityAction;
  staffId: string;
  staffName: string;
  periodMode: '' | 'day' | 'period';
  periodStartLabel: string;
  periodEndLabel: string;
  periodStartYmd: string;
  periodEndYmd: string;
  settlementCode: string;
  reportCode: string;
  appointmentCodes: string[];
  paymentCodes: string[];
  cashSessionCodes: string[];
  reportSnapshot: StaffSettlementAppointmentSnapshot[];
  loginAuditId: string;
  logoutReason: string;
  isMasterSession: boolean;
  appointmentCount: number;
  grossAmount: number;
  paidAmount: number;
  activityAt: string;
  activityDateLabel: string;
  activityTimeLabel: string;
  metadata?: Record<string, unknown> | null;
}

export type AppointmentStatus = 'agendado' | 'confirmado' | 'pagado' | 'cancelled';

/** Bloqueo de horario para una manicurista en un día específico. */
export interface StaffBlockedSlot {
  id: string;
  date: string;
  staffId: string;
  time: string;
  duration: number;
  reason?: string;
}

export interface Appointment {
  id: string;
  date: string; // e.g., "24 Oct, 2023"
  time: string; // e.g., "10:30 AM" or "10:00"
  serviceName: string;
  serviceSubtitle: string;
  serviceImage: string;
  clientName: string;
  clientId: string;
  staffId: string;
  staffName: string;
  staffInitials: string;
  cost: number;
  duration: number; // duración en minutos
  status: AppointmentStatus;
  bookedByReceptionistId?: string;
  bookedByReceptionistName?: string;
  bookedOnDate?: string;
}

export type ServiceCategory =
  | 'Uñas'
  | 'Manos y pies'
  | 'Cejas y mirada'
  | 'Cabello, estética y cuerpo';

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  subtitle: string;
  price: number; // 0 = precio pendiente de definir
  duration: number; // in minutes
  image: string;
  description: string;
  staffIds: string[];
  exclusive?: boolean;
}

export interface ScheduleConfig {
  startHour: number;
  endHour: number;
  slotIntervalMinutes: number;
  bookingDurationOptions: number[];
  closeDurationOptions: number[];
  closeReasons: string[];
  timeZone: string;
  masterLoginCode?: string;
}

export interface DailyStats {
  date: string;
  citas: number;
  sinConfirmar: number;
  pagadas: number;
  canceladas: number;
}

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';

export interface PosPayment {
  id: string;
  appointmentId: string;
  appointmentDate: string;
  clientId: string;
  clientName: string;
  staffId: string;
  staffName: string;
  serviceName: string;
  amount: number;
  tip: number;
  total: number;
  method: PaymentMethod;
  cashAmount: number;
  cardAmount: number;
  transferAmount: number;
  cashSessionId: string;
  processedByReceptionistId: string;
  processedByReceptionistName: string;
  notes: string;
  createdAt: string;
}

export interface CashSessionSummary {
  count: number;
  total: number;
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  tips: number;
  services: number;
}

export interface CashSession {
  id: string;
  status: 'open' | 'closed';
  shiftDate: string;
  openedByReceptionistId: string;
  openedByReceptionistName: string;
  closedByReceptionistId: string;
  closedByReceptionistName: string;
  openingFloat: number;
  closingCountedCash: number;
  closingCountedCard: number;
  closingCountedTransfer: number;
  expectedCash: number;
  expectedCard: number;
  expectedTransfer: number;
  variance: number;
  cardVariance: number;
  transferVariance: number;
  isPerfectCut: boolean;
  paymentsCount: number;
  totalAmount: number;
  totalEfectivo: number;
  totalTarjeta: number;
  totalTransferencia: number;
  closingNotes: string;
  openedAt: string;
  closedAt: string;
  openedWithMasterPin?: boolean;
  closedWithMasterPin?: boolean;
}

export interface CashRegisterState {
  session: CashSession | null;
  shiftSummary: CashSessionSummary;
  daySummary: CashSessionSummary;
  shiftPayments: PosPayment[];
  dayPayments: PosPayment[];
  today: string;
}
