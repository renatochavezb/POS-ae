import axios, { type InternalAxiosRequestConfig } from "axios";
import {
  Appointment,
  Client,
  DailyStats,
  CashRegisterState,
  CashSession,
  CashSessionSummary,
  PosPayment,
  PaymentMethod,
  Receptionist,
  ScheduleConfig,
  Staff,
  StaffBlockedSlot,
} from "@/components/pos/types";
import { getActiveReceptionistSession } from "@/libs/posSession";
import { INITIAL_RECEPTIONISTS } from "@/components/pos/data";

const posClient = axios.create({ baseURL: "/api" });

const attachReceptionistToRequest = (config: InternalAxiosRequestConfig) => {
  if (typeof window === "undefined") return config;

  const receptionist = getActiveReceptionistSession();
  if (!receptionist?.id) return config;

  config.headers.set("X-Pos-Receptionist-Id", receptionist.id);

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
    INITIAL_RECEPTIONISTS.find((member) => member.id === receptionist.id)?.name || "";

  config.data = {
    ...payload,
    bookedByReceptionistId: payload.bookedByReceptionistId || receptionist.id,
    bookedByReceptionistName: payload.bookedByReceptionistName || receptionistName,
  };

  return config;
};

posClient.interceptors.request.use((config) => attachReceptionistToRequest(config));

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

const posApi = {
  getLoginBootstrap(): Promise<{
    receptionists: Receptionist[];
    staff: Staff[];
  }> {
    return posClient.get("/pos/login/bootstrap");
  },
  verifyLogin(data: {
    role: "reception" | "manicurista";
    userId: string;
    pin: string;
  }): Promise<{
    success: boolean;
    role: "reception" | "manicurista";
    userId: string;
    userName: string;
    isMaster: boolean;
  }> {
    return posClient.post("/pos/login/verify", data);
  },
  getScheduleConfig(): Promise<ScheduleConfig> {
    return posClient.get("/pos/schedule-config");
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
  createStaff(data: Record<string, unknown>): Promise<Staff> {
    return posClient.post("/pos/staff", data);
  },
  updateStaff(staffId: string, data: Record<string, unknown>): Promise<Staff> {
    return posClient.patch(`/pos/staff/${staffId}`, data);
  },
  deleteStaff(staffId: string): Promise<{ success: boolean }> {
    return posClient.delete(`/pos/staff/${staffId}`);
  },
  getAppointments(): Promise<Appointment[]> {
    return posClient.get("/pos/appointments");
  },
  getAppointmentDailyStats(date: string): Promise<DailyStats> {
    return posClient.get("/pos/appointments/daily-stats", {
      params: { date },
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
    data: Record<string, unknown> & { staffStats?: StaffStatsPayload }
  ): Promise<Appointment> {
    return posClient.patch(`/pos/appointments/${appointmentId}`, data);
  },
  deleteAppointment(
    appointmentId: string,
    data?: {
      staffStats?: StaffStatsPayload | null;
      clientStats?: ClientStatsPayload | null;
      receptionistStats?: ReceptionistStatsPayload | null;
    }
  ): Promise<{ success: boolean }> {
    return posClient.delete(`/pos/appointments/${appointmentId}`, { data });
  },
  getBlockedSlots(): Promise<StaffBlockedSlot[]> {
    return posClient.get("/pos/blocked-slots");
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
      closingNotes?: string;
      receptionistId: string;
      pin: string;
    }
  ): Promise<CashSession> {
    return posClient.post(`/pos/cash-sessions/${sessionId}/close`, data);
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
  registerPayment(data: {
    appointmentId: string;
    amount: number;
    tip?: number;
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
};

export default posApi;
