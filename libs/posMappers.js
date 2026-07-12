import { normalizeAppointmentStatus } from "@/components/pos/appointmentStatus";
import { formatSpanishShortDateInTimeZone } from "@/components/pos/scheduleUtils";

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
    isActive: raw.isActive !== false,
    deactivatedAt: raw.deactivatedAt
      ? new Date(raw.deactivatedAt).toISOString()
      : raw.isActive === false && raw.updatedAt
      ? new Date(raw.updatedAt).toISOString()
      : "",
    deactivatedAgendaDate:
      raw.deactivatedAgendaDate ||
      (raw.deactivatedAt
        ? formatSpanishShortDateInTimeZone(new Date(raw.deactivatedAt))
        : raw.isActive === false && raw.updatedAt
        ? formatSpanishShortDateInTimeZone(new Date(raw.updatedAt))
        : ""),
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

export function mapServiceDoc(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.serviceCode,
    name: raw.name,
    category: raw.category,
    subtitle: raw.subtitle || "",
    price: raw.price ?? 0,
    duration: raw.duration ?? 60,
    image: raw.image || "",
    description: raw.description || "",
    staffIds: raw.staffIds || [],
    exclusive: Boolean(raw.exclusive),
    isActive: raw.isActive !== false,
  };
}

export function mapCashTicketDoc(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.ticketCode,
    appointmentId: raw.appointmentCode,
    appointmentDate: raw.appointmentDate,
    clientId: raw.clientId || "",
    clientName: raw.clientName,
    staffId: raw.staffId || "",
    staffName: raw.staffName || "",
    lines: (raw.lines || []).map((line) => ({
      serviceId: line.serviceId || "",
      name: line.name,
      price: line.price ?? 0,
    })),
    subtotal: raw.subtotal ?? 0,
    status: raw.status,
    submittedByStaffId: raw.submittedByStaffId || "",
    submittedByStaffName: raw.submittedByStaffName || "",
    submittedAt: raw.submittedAt ? new Date(raw.submittedAt).toISOString() : "",
    chargedAt: raw.chargedAt ? new Date(raw.chargedAt).toISOString() : "",
    paymentId: raw.paymentCode || "",
    workPhotos: raw.workPhotos || [],
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
    registeredAt: raw.registeredAt
      ? new Date(raw.registeredAt).toISOString()
      : raw.createdAt
      ? new Date(raw.createdAt).toISOString()
      : "",
    lastPaidVisitDate: raw.lastPaidVisitDate || "",
    bio: raw.bio || "",
    styleProfile: {
      bio: raw.styleProfile?.bio || "",
      tags: raw.styleProfile?.tags || [],
    },
    alerts: raw.alerts || [],
    totalSpent: raw.totalSpent ?? 0,
    visitsCount: raw.visitsCount ?? 0,
    averageTicket: raw.averageTicket ?? 0,
    crmSegmentFlags: {
      inactive: Boolean(raw.crmSegmentFlags?.inactive),
      upcoming: Boolean(raw.crmSegmentFlags?.upcoming),
      unconfirmed: Boolean(raw.crmSegmentFlags?.unconfirmed),
      nuevas: Boolean(raw.crmSegmentFlags?.nuevas),
      birthday: Boolean(raw.crmSegmentFlags?.birthday),
      alerts: Boolean(raw.crmSegmentFlags?.alerts),
      reschedule: Boolean(raw.crmSegmentFlags?.reschedule),
    },
    crmSegmentDetails: raw.crmSegmentDetails || {},
    crmSegmentsSyncedAt: raw.crmSegmentsSyncedAt
      ? new Date(raw.crmSegmentsSyncedAt).toISOString()
      : "",
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
    serviceLines: (raw.serviceLines || []).map((line) => ({
      serviceId: line.serviceId || "",
      name: line.name,
      price: line.price ?? 0,
    })),
    ticketId: raw.ticketCode || "",
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
    closingCountedCard: raw.closingCountedCard ?? 0,
    closingCountedTransfer: raw.closingCountedTransfer ?? 0,
    expectedCash: raw.expectedCash ?? 0,
    expectedCard: raw.expectedCard ?? 0,
    expectedTransfer: raw.expectedTransfer ?? 0,
    variance: raw.variance ?? 0,
    cardVariance: raw.cardVariance ?? 0,
    transferVariance: raw.transferVariance ?? 0,
    isPerfectCut: Boolean(raw.isPerfectCut),
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

export function mapAccountantDoc(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.accountantCode,
    name: raw.name,
    role: raw.role || "Contabilidad",
    email: raw.email || "",
    phone: raw.phone || "",
    isActive: raw.isActive !== false,
  };
}

export function mapStaffSettlementDoc(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.settlementCode,
    staffId: raw.staffId,
    staffName: raw.staffName,
    periodMode: raw.periodMode,
    periodStartLabel: raw.periodStartLabel,
    periodEndLabel: raw.periodEndLabel,
    periodStartYmd: raw.periodStartYmd,
    periodEndYmd: raw.periodEndYmd,
    settledAt: raw.settledAt ? new Date(raw.settledAt).toISOString() : "",
    settledDateLabel: raw.settledDateLabel,
    grossAmount: raw.grossAmount ?? 0,
    commissionAmount: raw.commissionAmount ?? 0,
    paidAmount: raw.paidAmount ?? 0,
    commissionPercent: raw.commissionPercent ?? 40,
    appointmentCount: raw.appointmentCount ?? 0,
    accountantId: raw.accountantId,
    accountantName: raw.accountantName,
    notes: raw.notes || "",
    appointmentCodes: raw.appointmentCodes || [],
    appointmentSnapshots: raw.appointmentSnapshots || [],
    paymentCodes: raw.paymentCodes || [],
    cashSessionCodes: raw.cashSessionCodes || [],
    loginAuditId: raw.loginAuditId || "",
  };
}

export function mapAccountantActivityDoc(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.activityCode,
    accountantId: raw.accountantId,
    accountantName: raw.accountantName,
    action: raw.action,
    staffId: raw.staffId || "",
    staffName: raw.staffName || "",
    periodMode: raw.periodMode || "",
    periodStartLabel: raw.periodStartLabel || "",
    periodEndLabel: raw.periodEndLabel || "",
    periodStartYmd: raw.periodStartYmd || "",
    periodEndYmd: raw.periodEndYmd || "",
    settlementCode: raw.settlementCode || "",
    reportCode: raw.reportCode || "",
    appointmentCodes: raw.appointmentCodes || [],
    paymentCodes: raw.paymentCodes || [],
    cashSessionCodes: raw.cashSessionCodes || [],
    reportSnapshot: raw.reportSnapshot || [],
    loginAuditId: raw.loginAuditId || "",
    logoutReason: raw.logoutReason || "",
    isMasterSession: Boolean(raw.isMasterSession),
    appointmentCount: raw.appointmentCount ?? 0,
    grossAmount: raw.grossAmount ?? 0,
    paidAmount: raw.paidAmount ?? 0,
    activityAt: raw.activityAt ? new Date(raw.activityAt).toISOString() : "",
    activityDateLabel: raw.activityDateLabel,
    activityTimeLabel: raw.activityTimeLabel,
    metadata: raw.metadata || null,
  };
}
