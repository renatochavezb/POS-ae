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
  loginCode?: string;
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

export type AppointmentStatus = 'agendado' | 'confirmado' | 'terminado' | 'cancelled';

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

export interface WeeklyHoursSlot {
  startHour: number;
  endHour: number;
  closed: boolean;
}

export interface WeeklyHoursConfig {
  weekday: WeeklyHoursSlot;
  saturday: WeeklyHoursSlot;
  sundayHoliday: WeeklyHoursSlot;
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
  weeklyHours?: WeeklyHoursConfig;
}

export interface DailyStats {
  date: string;
  citas: number;
  sinConfirmar: number;
  pagadas: number;
  canceladas: number;
}

export interface WeeklyBreakdownDay {
  dateLabel: string;
  dayLabel: string;
  count: number;
  sales: number;
  commission: number;
}

export interface WeeklyStaffBreakdown {
  staffId: string;
  staffName: string;
  count: number;
  sales: number;
  commission: number;
  commissionPercent: number;
}

export interface WeeklyCutTurn {
  sessionCode: string;
  shiftDate: string;
  totalAmount: number;
  paymentsCount: number;
  receptionistName: string;
  closedAt: string;
}

export interface WeeklyCutReceptionist {
  receptionistId: string;
  name: string;
  count: number;
  total: number;
}

export interface WeeklyStats {
  weekStartDate: string;
  weekEndDate: string;
  weekRangeLabel: string;
  completedAppointmentsCount: number;
  completedByDay: WeeklyBreakdownDay[];
  completedByStaff: WeeklyStaffBreakdown[];
  previousWeekCompletedCount: number;
  completedWeekDeltaPercent: number | null;
  grossSales: number;
  estimatedCommission: number;
  tips: number;
  salonNet: number;
  salesByDay: WeeklyBreakdownDay[];
  salesByStaff: WeeklyStaffBreakdown[];
  previousWeekGrossSales: number;
  grossSalesWeekDeltaPercent: number | null;
  cutsCount: number;
  cutsTotal: number;
  cutsTotalEfectivo: number;
  cutsTotalTarjeta: number;
  cutsTotalTransferencia: number;
  cutsByTurn: WeeklyCutTurn[];
  cutsByReceptionist: WeeklyCutReceptionist[];
  computedAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'gift_card' | 'mixto';

export interface CashTicketLine {
  serviceId?: string;
  name: string;
  price: number;
}

export type CashTicketStatus = 'submitted' | 'charged' | 'cancelled';

export interface PosCashTicket {
  id: string;
  appointmentId: string;
  appointmentDate: string;
  clientId: string;
  clientName: string;
  staffId: string;
  staffName: string;
  lines: CashTicketLine[];
  subtotal: number;
  status: CashTicketStatus;
  submittedByStaffId: string;
  submittedByStaffName: string;
  submittedAt: string;
  chargedAt: string;
  paymentId: string;
  workPhotos?: string[];
}

export interface PosPayment {
  id: string;
  transactionType?: 'appointment' | 'gift_card_sale';
  giftCardCode?: string;
  appointmentId: string;
  appointmentDate: string;
  clientId: string;
  clientName: string;
  staffId: string;
  staffName: string;
  serviceName: string;
  serviceLines?: CashTicketLine[];
  ticketId?: string;
  amount: number;
  tip: number;
  total: number;
  method: PaymentMethod;
  cashAmount: number;
  cardAmount: number;
  transferAmount: number;
  giftCardAmount: number;
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
  gift_card: number;
  tips: number;
  services: number;
  giftCardSales: number;
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
  totalGiftCard: number;
  totalGiftCardSales: number;
  closingNotes: string;
  openedAt: string;
  closedAt: string;
  openedWithMasterPin?: boolean;
  closedWithMasterPin?: boolean;
}

export interface PosGiftCard {
  id: string;
  code: string;
  initialValue: number;
  balance: number;
  status: 'active' | 'redeemed' | 'cancelled';
  soldDate: string;
  soldAt: string;
  paymentId: string;
  cashSessionId: string;
  purchaseMethod: Exclude<PaymentMethod, 'gift_card'>;
  soldByReceptionistId: string;
  soldByReceptionistName: string;
  notes: string;
}

export interface CashRegisterState {
  session: CashSession | null;
  shiftSummary: CashSessionSummary;
  daySummary: CashSessionSummary;
  shiftPayments: PosPayment[];
  dayPayments: PosPayment[];
  today: string;
  cashDay: string;
}

export type ExpenseCategoryRole = "reception" | "accountant" | "both";

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string;
  allowedRoles: ExpenseCategoryRole;
  isActive: boolean;
}

export type ExpensePaymentMethod = "efectivo" | "tarjeta" | "transferencia" | "cheque" | "gift_card";
export type ExpenseStatus = "pendiente" | "pagado" | "cancelado";

export interface Expense {
  id: string;
  categoryCode: string;
  categoryName: string;
  description: string;
  amount: number;
  expenseDate: string;
  paymentMethod: ExpensePaymentMethod;
  status: ExpenseStatus;
  supplierCode: string;
  supplierName: string;
  receiptReference: string;
  notes: string;
  recordedByRole: "reception" | "accountant" | "master";
  recordedById: string;
  recordedByName: string;
  approvedByAccountantId: string;
  cashSessionCode: string;
  createdAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  taxId: string;
  category: string;
  paymentTerms: string;
  notes: string;
  isActive: boolean;
  recordedByRole: "reception" | "accountant" | "master";
  recordedById: string;
  recordedByName: string;
  createdAt?: string;
}

export interface InventoryCategory {
  id: string;
  label: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  system: string;
  brand: string;
  shade: string;
  unit: string;
  currentStock: number;
  minStock: number;
  unitCost: number;
  supplierCode: string;
  supplierName: string;
  lastRestockedAt: string;
  notes: string;
  isActive: boolean;
  recordedByRole: "reception" | "accountant" | "master";
  recordedById: string;
  recordedByName: string;
  createdAt?: string;
}

export interface PurchaseLine {
  itemCode: string;
  name: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export type PurchaseStatus = "borrador" | "recibida" | "cancelada";
export type PurchasePaymentStatus = "pendiente" | "parcial" | "pagada";

export interface Purchase {
  id: string;
  supplierCode: string;
  supplierName: string;
  purchaseDate: string;
  items: PurchaseLine[];
  subtotal: number;
  tax: number;
  total: number;
  status: PurchaseStatus;
  paymentStatus: PurchasePaymentStatus;
  notes: string;
  recordedByRole: "reception" | "accountant" | "master";
  recordedById: string;
  recordedByName: string;
  createdAt?: string;
}

export type PayableStatus = "pendiente" | "pagada" | "vencida" | "cancelada";

export interface Payable {
  id: string;
  supplierCode: string;
  supplierName: string;
  concept: string;
  amount: number;
  dueDate: string;
  status: PayableStatus;
  linkedExpenseCode: string;
  linkedPurchaseCode: string;
  paidAt: string;
  paidAmount: number;
  notes: string;
  recordedByRole: "reception" | "accountant" | "master";
  recordedById: string;
  recordedByName: string;
  createdAt?: string;
}
