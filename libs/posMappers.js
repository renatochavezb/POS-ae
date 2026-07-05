import { normalizeAppointmentStatus } from "@/components/pos/appointmentStatus";

export function mapStaffDoc(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.staffCode,
    name: raw.name,
    email: raw.email || "",
    phone: raw.phone || "",
    role: raw.role,
    status: raw.status,
    rating: raw.rating ?? 5,
    specialty: raw.specialty || "",
    shift: raw.shift || "Completo",
    completedToday: raw.completedToday ?? 0,
    totalToday: raw.totalToday ?? 0,
    weeklyRevenue: raw.weeklyRevenue ?? 0,
    commissionPercent: raw.commissionPercent ?? 40,
    bio: raw.bio || "",
    image: raw.image || "",
    color: raw.color,
    colorLight: raw.colorLight,
    allowedServiceIds: raw.allowedServiceIds || [],
  };
}

export function mapReceptionistDoc(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.receptionistCode,
    name: raw.name,
    role: raw.role || "Recepción",
    loginCode: raw.loginCode,
    bookingsToday: raw.bookingsToday ?? 0,
    bookingsTodayDate: raw.bookingsTodayDate || "",
    image: raw.image || "",
    color: raw.color,
    colorLight: raw.colorLight,
  };
}

export function mapAppointmentDoc(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.appointmentCode,
    date: raw.date,
    time: raw.time,
    serviceName: raw.serviceName,
    serviceSubtitle: raw.serviceSubtitle || "",
    serviceImage: raw.serviceImage || "",
    clientName: raw.clientName,
    clientId: raw.clientId,
    staffId: raw.staffId,
    staffName: raw.staffName,
    staffInitials: raw.staffInitials,
    cost: raw.cost ?? 0,
    duration: raw.duration ?? 60,
    status: normalizeAppointmentStatus(raw.status),
    bookedByReceptionistId: raw.bookedByReceptionistId || "",
    bookedByReceptionistName: raw.bookedByReceptionistName || "",
    bookedOnDate: raw.bookedOnDate || "",
  };
}

export function mapBlockedSlotDoc(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.blockedSlotCode,
    date: raw.date,
    staffId: raw.staffId,
    time: raw.time,
    duration: raw.duration ?? 30,
    reason: raw.reason || "",
  };
}

export function mapClientDoc(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.clientCode,
    name: raw.name,
    email: raw.email || "",
    phone: raw.phone || "",
    birthday: raw.birthday || "No especificado",
    address: raw.address || "No especificada",
    isPlatinum: Boolean(raw.isPlatinum),
    memberSince: raw.memberSince || "",
    bio: raw.bio || "",
    styleProfile: {
      bio: raw.styleProfile?.bio || "",
      tags: raw.styleProfile?.tags || [],
    },
    alerts: raw.alerts || [],
    totalSpent: raw.totalSpent ?? 0,
    visitsCount: raw.visitsCount ?? 0,
    averageTicket: raw.averageTicket ?? 0,
  };
}

export function mapPaymentDoc(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.paymentCode,
    appointmentId: raw.appointmentCode,
    appointmentDate: raw.appointmentDate,
    clientId: raw.clientId || "",
    clientName: raw.clientName,
    staffId: raw.staffId || "",
    staffName: raw.staffName || "",
    serviceName: raw.serviceName || "",
    amount: raw.amount ?? 0,
    tip: raw.tip ?? 0,
    total: raw.total ?? 0,
    method: raw.method,
    cashAmount: raw.cashAmount ?? 0,
    cardAmount: raw.cardAmount ?? 0,
    transferAmount: raw.transferAmount ?? 0,
    cashSessionId: raw.cashSessionCode || "",
    processedByReceptionistId: raw.processedByReceptionistId || "",
    processedByReceptionistName: raw.processedByReceptionistName || "",
    notes: raw.notes || "",
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : "",
  };
}

export function mapCashSessionDoc(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.sessionCode,
    status: raw.status,
    shiftDate: raw.shiftDate,
    openedByReceptionistId: raw.openedByReceptionistId || "",
    openedByReceptionistName: raw.openedByReceptionistName || "",
    closedByReceptionistId: raw.closedByReceptionistId || "",
    closedByReceptionistName: raw.closedByReceptionistName || "",
    openingFloat: raw.openingFloat ?? 0,
    closingCountedCash: raw.closingCountedCash ?? 0,
    expectedCash: raw.expectedCash ?? 0,
    variance: raw.variance ?? 0,
    paymentsCount: raw.paymentsCount ?? 0,
    totalAmount: raw.totalAmount ?? 0,
    totalEfectivo: raw.totalEfectivo ?? 0,
    totalTarjeta: raw.totalTarjeta ?? 0,
    totalTransferencia: raw.totalTransferencia ?? 0,
    closingNotes: raw.closingNotes || "",
    openedAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : "",
    closedAt: raw.closedAt ? new Date(raw.closedAt).toISOString() : "",
    openedWithMasterPin: Boolean(raw.openedWithMasterPin),
    closedWithMasterPin: Boolean(raw.closedWithMasterPin),
  };
}
