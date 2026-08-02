import axios, { type InternalAxiosRequestConfig } from "axios";
import {
  Appointment,
  Client,
  DailyStats,
  WeeklyStats,
  StaffPerformanceHistory,
  CashRegisterState,
  CashSession,
  CashSessionSummary,
  PosPayment,
  PosGiftCard,
  PaymentMethod,
  PosCashTicket,
  CashTicketLine,
  Service,
  Receptionist,
  ScheduleConfig,
  Staff,
  StaffBlockedSlot,
  Accountant,
  StaffSettlement,
  StaffSettlementAppointmentSnapshot,
  AccountantActivity,
  Expense,
  ExpenseCategory,
  Supplier,
  InventoryCategory,
  InventoryItem,
  Purchase,
  Payable,
} from "@/components/pos/types";
import {
  getActiveAccountantSession,
  getActiveReceptionistSession,
  readPosSession,
} from "@/libs/posSession";
import { INITIAL_RECEPTIONISTS } from "@/components/pos/data";

const posClient = axios.create({ baseURL: "/api" });

const attachMasterSessionHeader = (config: InternalAxiosRequestConfig) => {
  if (typeof window === "undefined") return config;

  const session = readPosSession();
  if (session?.isMaster) {
    config.headers.set("X-Pos-Master-Session", "true");
  }

  return config;
};

const attachReceptionistToRequest = (config: InternalAxiosRequestConfig) => {
  if (typeof window === "undefined") return config;

  const receptionist = getActiveReceptionistSession();
  const session = readPosSession();
  if (receptionist?.id) {
    config.headers.set("X-Pos-Receptionist-Id", receptionist.id);
    const receptionistName =
      INITIAL_RECEPTIONISTS.find((member) => member.id === receptionist.id)?.name || "";
    if (receptionistName) {
      config.headers.set("X-Pos-Receptionist-Name", receptionistName);
    }
  } else if (session?.isMaster) {
    config.headers.set("X-Pos-Receptionist-Name", "Administrador");
  }

  const isCreateAppointment =
    config.method?.toLowerCase() === "post" &&
    config.url?.includes("/pos/appointments") &&
    !config.url?.includes("/pos/appointments/");

  if (!isCreateAppointment) return config;

  const payload =
    config.data && typeof config.data === "object" && !Array.isArray(config.data)
      ? { ...config.data }
      : {};

  const receptionistName =
    INITIAL_RECEPTIONISTS.find((member) => member.id === receptionist?.id)?.name || "";

  config.data = {
    ...payload,
    bookedByReceptionistId: payload.bookedByReceptionistId || receptionist?.id,
    bookedByReceptionistName: payload.bookedByReceptionistName || receptionistName,
  };

  return config;
};

const attachAccountantToRequest = (config: InternalAxiosRequestConfig) => {
  if (typeof window === "undefined") return config;

  const accountant = getActiveAccountantSession();
  if (!accountant?.id) return config;

  config.headers.set("X-Pos-Accountant-Id", accountant.id);
  if (accountant.name) {
    config.headers.set("X-Pos-Accountant-Name", accountant.name);
  }

  return config;
};

const attachStaffToRequest = (config: InternalAxiosRequestConfig) => {
  if (typeof window === "undefined") return config;

  const session = readPosSession();
  if (session?.role === "manicurista" && session.staffId) {
    config.headers.set("X-Pos-Staff-Id", session.staffId);
  }

  return config;
};

posClient.interceptors.request.use((config) =>
  attachStaffToRequest(
    attachAccountantToRequest(attachReceptionistToRequest(attachMasterSessionHeader(config)))
  )
);

posClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error?.response?.data?.error || error.message || "Error en la API del POS";
    return Promise.reject(new Error(message));
  }
);

type ReceptionistStatsPayload = {
  receptionistId: string;
  bookingsToday?: number;
};

type StaffStatsPayload = {
  staffId: string;
  totalToday?: number;
  completedToday?: number;
  weeklyRevenue?: number;
};

type ClientStatsPayload = {
  clientId: string;
  visitsCount?: number;
  totalSpent?: number;
  averageTicket?: number;
};

type CreateAppointmentResponse = Appointment & {
  receptionists?: Receptionist[];
};

export type ReceptionistAuthPayload = {
  receptionistId: string;
  pin: string;
};

type AppointmentMutationPayload = {
  staffStats?: StaffStatsPayload | null;
  clientStats?: ClientStatsPayload | null;
  receptionistStats?: ReceptionistStatsPayload | null;
  receptionistId?: string;
  pin?: string;
  adminOverride?: boolean;
};

const posApi = {
  getLoginBootstrap(): Promise<{
    receptionists: Receptionist[];
    staff: Staff[];
    accountants: Accountant[];
  }> {
    return posClient.get("/pos/login/bootstrap");
  },
  verifyLogin(data: {
    role: "reception" | "manicurista" | "accountant" | "admin";
    userId: string;
    pin: string;
    openingFloat?: number;
  }): Promise<{
    success: boolean;
    role: "reception" | "manicurista" | "accountant";
    userId: string;
    userName: string;
    isMaster: boolean;
    cashSession?: CashSession | null;
    cashSessionOpened?: boolean;
  }> {
    return posClient.post("/pos/login/verify", data);
  },
  getScheduleConfig(): Promise<ScheduleConfig> {
    return posClient.get("/pos/schedule-config");
  },

  updateScheduleConfig(payload: {
    pin: string;
    weeklyHours: ScheduleConfig["weeklyHours"];
    cabinCapacity?: number;
  }): Promise<ScheduleConfig> {
    return posClient.patch("/pos/schedule-config", payload);
  },
  getLoginCodes(): Promise<{
    staff: Array<{
      role: "staff";
      id: string;
      name: string;
      subtitle: string;
      loginCode: string;
      isActive: boolean;
    }>;
    receptionists: Array<{
      role: "reception";
      id: string;
      name: string;
      subtitle: string;
      loginCode: string;
      isActive: boolean;
    }>;
    accountants: Array<{
      role: "accountant";
      id: string;
      name: string;
      subtitle: string;
      loginCode: string;
      isActive: boolean;
    }>;
    master: {
      role: "master";
      id: string;
      name: string;
      subtitle: string;
      loginCode: string;
      isActive: boolean;
    };
  }> {
    return posClient.get("/pos/admin/login-codes");
  },
  updateLoginCodes(payload: {
    adminPin: string;
    updates: Array<{
      role: "staff" | "reception" | "accountant" | "master";
      id: string;
      loginCode: string;
      name?: string;
    }>;
  }): Promise<{ success: boolean; updated: Array<{ role: string; id: string; loginCode: string }> }> {
    return posClient.patch("/pos/admin/login-codes", payload);
  },
  getClients(): Promise<Client[]> {
    return posClient.get("/pos/clients");
  },
  createClient(data: Record<string, unknown>): Promise<Client> {
    return posClient.post("/pos/clients", data);
  },
  updateClient(clientId: string, data: Record<string, unknown>): Promise<Client> {
    return posClient.patch(`/pos/clients/${clientId}`, data);
  },
  deleteClient(clientId: string): Promise<{ success: boolean }> {
    return posClient.delete(`/pos/clients/${clientId}`);
  },
  getStaff(): Promise<Staff[]> {
    return posClient.get("/pos/staff");
  },
  getReceptionists(): Promise<Receptionist[]> {
    return posClient.get("/pos/receptionists");
  },
  getAccountants(): Promise<Accountant[]> {
    return posClient.get("/pos/accountants");
  },
  getStaffSettlements(staffId: string): Promise<StaffSettlement[]> {
    return posClient.get(`/pos/staff/${staffId}/settlements`);
  },
  createStaffSettlement(data: {
    staffId: string;
    periodMode: "day" | "period";
    periodStartLabel: string;
    periodEndLabel: string;
    periodStartYmd: string;
    periodEndYmd: string;
    accountantId: string;
    pin?: string;
    accountantSession?: boolean;
    notes?: string;
  }): Promise<StaffSettlement> {
    return posClient.post("/pos/staff-settlements", data);
  },
  recordAccountantActivity(data: {
    accountantId: string;
    action: "login" | "logout" | "report_download" | "liquidation";
    staffId?: string;
    staffName?: string;
    periodMode?: "day" | "period" | "";
    periodStartLabel?: string;
    periodEndLabel?: string;
    periodStartYmd?: string;
    periodEndYmd?: string;
    settlementCode?: string;
    reportCode?: string;
    appointmentCount?: number;
    grossAmount?: number;
    paidAmount?: number;
    appointmentCodes?: string[];
    paymentCodes?: string[];
    cashSessionCodes?: string[];
    reportSnapshot?: StaffSettlementAppointmentSnapshot[];
    loginAuditId?: string;
    logoutReason?: "manual" | "browser_close" | "";
    isMasterSession?: boolean;
    metadata?: Record<string, unknown> | null;
  }): Promise<AccountantActivity> {
    return posClient.post("/pos/accountant-activities", data);
  },
  getAccountantActivities(params?: {
    accountantId?: string;
    staffId?: string;
    action?: string;
    limit?: number;
  }): Promise<AccountantActivity[]> {
    return posClient.get("/pos/accountant-activities", { params });
  },
  recordAccountantLogoutBeacon(accountantId: string): boolean {
    if (typeof window === "undefined" || typeof navigator.sendBeacon !== "function") {
      return false;
    }

    const payload = JSON.stringify({
      accountantId,
      action: "logout",
      logoutReason: "browser_close",
    });
    const blob = new Blob([payload], { type: "application/json" });
    return navigator.sendBeacon("/api/pos/accountant-activities", blob);
  },
  createStaff(data: Record<string, unknown>): Promise<Staff> {
    return posClient.post("/pos/staff", data);
  },
  updateStaff(staffId: string, data: Record<string, unknown>): Promise<Staff> {
    return posClient.patch(`/pos/staff/${staffId}`, data);
  },
  uploadStaffPhoto(staffId: string, file: File): Promise<Staff> {
    const formData = new FormData();
    formData.append("photo", file);
    return posClient.post(`/pos/staff/${staffId}/photo`, formData);
  },
  deleteStaff(
    staffId: string
  ): Promise<{
    success: boolean;
    deactivated?: boolean;
    hadAppointments?: boolean;
    deactivatedAt?: string;
    deactivatedAgendaDate?: string;
  }> {
    return posClient.delete(`/pos/staff/${staffId}`);
  },
  getAppointments(params?: {
    daysBefore?: number;
    daysAfter?: number;
  }): Promise<Appointment[]> {
    return posClient.get("/pos/appointments", {
      params: {
        daysBefore: params?.daysBefore,
        daysAfter: params?.daysAfter,
      },
    });
  },
  getAppointmentDailyStats(date: string): Promise<DailyStats> {
    return posClient.get("/pos/appointments/daily-stats", {
      params: { date },
    });
  },
  getWeeklyStats(params?: {
    weekStart?: string;
    refresh?: boolean;
  }): Promise<{ scope: string; weekStartDate: string; snapshot: WeeklyStats }> {
    return posClient.get("/pos/weekly-stats", {
      params: {
        weekStart: params?.weekStart,
        refresh: params?.refresh ? "1" : undefined,
      },
    });
  },
  refreshAllWeeklyStats(): Promise<{
    scope: string;
    count: number;
    snapshots: WeeklyStats[];
  }> {
    return posClient.get("/pos/weekly-stats", {
      params: { refresh: "all" },
    });
  },
  getWeeklyHistory(): Promise<{
    scope: string;
    count: number;
    snapshots: WeeklyStats[];
  }> {
    return posClient.get("/pos/weekly-stats", {
      params: { scope: "history" },
    });
  },
  getStaffPerformanceHistory(): Promise<StaffPerformanceHistory> {
    return posClient.get("/pos/weekly-stats", {
      params: { scope: "staff-performance" },
    });
  },
  createAppointment(
    data: Record<string, unknown> & {
      staffStats?: StaffStatsPayload;
      clientStats?: ClientStatsPayload;
      receptionistStats?: ReceptionistStatsPayload;
      bookedByReceptionistId?: string;
      bookedByReceptionistName?: string;
      bookedOnDate?: string;
    }
  ): Promise<CreateAppointmentResponse> {
    return posClient.post("/pos/appointments", data);
  },
  updateAppointment(
    appointmentId: string,
    data: Record<string, unknown> & {
      staffStats?: StaffStatsPayload;
      receptionistId?: string;
      pin?: string;
      adminOverride?: boolean;
    }
  ): Promise<Appointment> {
    return posClient.patch(`/pos/appointments/${appointmentId}`, data);
  },
  deleteAppointment(
    appointmentId: string,
    data?: AppointmentMutationPayload
  ): Promise<{ success: boolean }> {
    return posClient.delete(`/pos/appointments/${appointmentId}`, { data });
  },
  getBlockedSlots(params?: {
    daysBefore?: number;
    daysAfter?: number;
  }): Promise<StaffBlockedSlot[]> {
    return posClient.get("/pos/blocked-slots", {
      params: {
        daysBefore: params?.daysBefore,
        daysAfter: params?.daysAfter,
      },
    });
  },
  createBlockedSlot(data: Record<string, unknown>): Promise<StaffBlockedSlot> {
    return posClient.post("/pos/blocked-slots", data);
  },
  deleteBlockedSlot(blockedSlotId: string): Promise<{ success: boolean }> {
    return posClient.delete(`/pos/blocked-slots/${blockedSlotId}`);
  },
  getCashRegisterState(): Promise<CashRegisterState> {
    return posClient.get("/pos/cash-sessions/current");
  },
  verifyMasterPin(pin: string): Promise<{ success: boolean }> {
    return posClient.post("/pos/auth/verify-master", { pin });
  },
  openCashSession(data: {
    openingFloat: number;
    receptionistId: string;
    pin: string;
  }): Promise<CashSession> {
    return posClient.post("/pos/cash-sessions/open", data);
  },
  closeCashSession(
    sessionId: string,
    data: {
      closingCountedCash: number;
      closingCountedCard: number;
      closingCountedTransfer: number;
      closingNotes?: string;
      receptionistId: string;
      pin: string;
    }
  ): Promise<CashSession> {
    return posClient.post(`/pos/cash-sessions/${sessionId}/close`, data);
  },
  updateCashSessionShiftDate(
    sessionId: string,
    data: {
      shiftDate: string;
      receptionistId: string;
      pin: string;
    }
  ): Promise<CashSession> {
    return posClient.patch(`/pos/cash-sessions/${sessionId}/shift-date`, data);
  },
  getCashSessionHistory(params?: {
    scope?: "today" | "all";
    date?: string;
    limit?: number;
  }): Promise<{
    scope: string;
    date: string | null;
    sessions: CashSession[];
  }> {
    return posClient.get("/pos/cash-sessions/history", { params });
  },
  getPayments(params?: { date?: string; sessionCode?: string }): Promise<{
    date: string;
    sessionCode: string;
    summary: CashSessionSummary;
    payments: PosPayment[];
  }> {
    return posClient.get("/pos/payments", { params });
  },
  getServices(): Promise<Service[]> {
    return posClient.get("/pos/services");
  },
  getAdminServices(): Promise<{ services: Service[] }> {
    return posClient.get("/pos/admin/services");
  },
  updateAdminService(data: {
    serviceCode: string;
    price?: number;
    pricingMode?: Service["pricingMode"];
    nailMax?: number;
    name?: string;
    isActive?: boolean;
  }): Promise<{ service: Service }> {
    return posClient.patch("/pos/admin/services", data);
  },
  importAdminServicesExcel(file: File): Promise<{
    success: boolean;
    updated: number;
    created: number;
    total: number;
    services: Service[];
  }> {
    const formData = new FormData();
    formData.append("file", file);
    return posClient.post("/pos/admin/services/import", formData);
  },
  getCashTickets(params?: {
    date?: string;
    status?: "submitted" | "charged" | "cancelled" | "all";
    staffId?: string;
    appointmentId?: string;
  }): Promise<{ date: string; tickets: PosCashTicket[] }> {
    return posClient.get("/pos/cash-tickets", { params });
  },
  submitCashTicket(data: {
    appointmentId: string;
    lines: CashTicketLine[];
    workPhotos: string[];
    submittedByStaffId?: string;
    submittedByStaffName?: string;
  }): Promise<{ ticket: PosCashTicket }> {
    return posClient.post("/pos/cash-tickets", data);
  },
  uploadCashTicketWorkPhotos(
    appointmentId: string,
    files: File[]
  ): Promise<{ photos: string[] }> {
    const formData = new FormData();
    formData.append("appointmentId", appointmentId);
    files.forEach((file) => formData.append("photos", file));
    return posClient.post("/pos/cash-tickets/work-photos", formData);
  },
  updateCashTicket(
    ticketId: string,
    data: { lines: CashTicketLine[] }
  ): Promise<{ ticket: PosCashTicket }> {
    return posClient.patch(`/pos/cash-tickets/${ticketId}`, data);
  },
  registerPayment(data: {
    appointmentId: string;
    ticketId?: string;
    amount: number;
    tip?: number;
    discount?: number;
    discountSplits?: {
      role: 'staff' | 'receptionist';
      id: string;
      name: string;
      percent: number;
      amount?: number;
    }[];
    discountTargetRole?: '' | 'staff' | 'receptionist';
    discountTargetId?: string;
    discountTargetName?: string;
    discountReason?: string;
    isWarranty?: boolean;
    warrantyOriginalStaffId?: string;
    warrantyOriginalStaffName?: string;
    warrantyPerformedByStaffId?: string;
    warrantyPerformedByStaffName?: string;
    warrantyWorkDescription?: string;
    warrantyServiceAmount?: number;
    method: PaymentMethod;
    cashAmount?: number;
    cardAmount?: number;
    transferAmount?: number;
    notes?: string;
    processedByReceptionistId?: string;
    processedByReceptionistName?: string;
  }): Promise<{ payment: PosPayment; appointment: Appointment }> {
    return posClient.post("/pos/payments", data);
  },
  sellGiftCard(data: {
    value: number;
    method: Exclude<PaymentMethod, "gift_card">;
    cashAmount?: number;
    cardAmount?: number;
    transferAmount?: number;
    notes?: string;
    processedByReceptionistId?: string;
    processedByReceptionistName?: string;
  }): Promise<{ giftCard: PosGiftCard; payment: PosPayment }> {
    return posClient.post("/pos/gift-cards", data);
  },
  getExpenseCategories(): Promise<ExpenseCategory[]> {
    return posClient.get("/pos/expense-categories");
  },
  getExpenses(params?: { status?: string; categoryCode?: string }): Promise<Expense[]> {
    return posClient.get("/pos/expenses", { params });
  },
  createExpense(data: {
    categoryCode: string;
    description: string;
    amount: number;
    expenseDate?: string;
    paymentMethod?: Expense["paymentMethod"];
    status?: Expense["status"];
    supplierCode?: string;
    supplierName?: string;
    receiptReference?: string;
    notes?: string;
    cashSessionCode?: string;
  }): Promise<Expense> {
    return posClient.post("/pos/expenses", data);
  },
  getSuppliers(): Promise<Supplier[]> {
    return posClient.get("/pos/suppliers");
  },
  createSupplier(data: {
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    taxId?: string;
    category?: string;
    paymentTerms?: string;
    notes?: string;
  }): Promise<Supplier> {
    return posClient.post("/pos/suppliers", data);
  },
  getInventoryCategories(): Promise<InventoryCategory[]> {
    return posClient.get("/pos/inventory-categories");
  },
  createInventoryCategory(data: {
    name: string;
    description?: string;
  }): Promise<InventoryCategory> {
    return posClient.post("/pos/inventory-categories", data);
  },
  getInventoryItems(): Promise<InventoryItem[]> {
    return posClient.get("/pos/inventory");
  },
  createInventoryItem(data: {
    name: string;
    category?: string;
    system?: string;
    brand?: string;
    shade?: string;
    unit?: string;
    currentStock?: number;
    minStock?: number;
    unitCost?: number;
    supplierCode?: string;
    supplierName?: string;
    notes?: string;
  }): Promise<InventoryItem> {
    return posClient.post("/pos/inventory", data);
  },
  adjustInventoryStock(
    itemCode: string,
    stockAdjustment: number,
    notes?: string
  ): Promise<InventoryItem> {
    return posClient.patch(`/pos/inventory/${itemCode}`, { stockAdjustment, notes });
  },
  getPurchases(): Promise<Purchase[]> {
    return posClient.get("/pos/purchases");
  },
  createPurchase(data: {
    supplierCode?: string;
    supplierName: string;
    purchaseDate?: string;
    items: Array<{
      itemCode?: string;
      name: string;
      quantity: number;
      unitCost: number;
    }>;
    tax?: number;
    status?: Purchase["status"];
    paymentStatus?: Purchase["paymentStatus"];
    notes?: string;
  }): Promise<Purchase> {
    return posClient.post("/pos/purchases", data);
  },
  getPayables(): Promise<Payable[]> {
    return posClient.get("/pos/payables");
  },
  createPayable(data: {
    supplierCode?: string;
    supplierName: string;
    concept: string;
    amount: number;
    dueDate: string;
    status?: Payable["status"];
    linkedExpenseCode?: string;
    linkedPurchaseCode?: string;
    notes?: string;
  }): Promise<Payable> {
    return posClient.post("/pos/payables", data);
  },
  updatePayable(
    payableCode: string,
    data: { status?: Payable["status"]; paidAmount?: number; notes?: string }
  ): Promise<Payable> {
    return posClient.patch(`/pos/payables/${payableCode}`, data);
  },
};

export default posApi;
