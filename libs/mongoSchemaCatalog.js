export const MONGO_RELATIONSHIPS = [
  {
    from: "PosClient",
    field: "clientCode",
    to: "PosAppointment",
    targetField: "clientId",
    description: "Cada cita apunta al cliente por código (ej. SA-4092).",
  },
  {
    from: "PosStaff",
    field: "staffCode",
    to: "PosAppointment",
    targetField: "staffId",
    description: "La manicurista asignada a la cita.",
  },
  {
    from: "PosStaff",
    field: "staffCode",
    to: "PosBlockedSlot",
    targetField: "staffId",
    description: "Bloqueos de agenda por manicurista.",
  },
  {
    from: "PosReceptionist",
    field: "receptionistCode",
    to: "PosAppointment",
    targetField: "bookedByReceptionistId",
    description: "Quién agendó la cita en recepción.",
  },
  {
    from: "PosAppointment",
    field: "appointmentCode",
    to: "PosPayment",
    targetField: "appointmentCode",
    description: "El cobro queda ligado a una cita; al pagar la cita pasa a pagado.",
  },
  {
    from: "PosCashSession",
    field: "sessionCode",
    to: "PosPayment",
    targetField: "cashSessionCode",
    description: "Pagos del turno de caja abierto.",
  },
  {
    from: "PosReceptionist",
    field: "receptionistCode",
    to: "PosCashSession",
    targetField: "openedByReceptionistId / closedByReceptionistId",
    description: "Apertura y cierre de turno con PIN de recepción o master.",
  },
  {
    from: "PosCashSession",
    field: "sessionCode",
    to: "PosLoginAudit",
    targetField: "cashSessionCode",
    description: "Auditoría de apertura/cierre de caja.",
  },
  {
    from: "PosDailySnapshot",
    field: "date",
    to: "PosAppointment",
    targetField: "date",
    description: "Contadores diarios derivados del estado de citas por fecha.",
  },
  {
    from: "PosScheduleConfig",
    field: "configCode (default)",
    to: "—",
    targetField: "global",
    description: "Horario, slots, razones de cierre y clave master del POS.",
  },
];

export const MONGO_COLLECTIONS = [
  {
    model: "PosClient",
    collection: "posclients",
    domain: "POS Salón",
    purpose: "Clientas del estudio: perfil, gasto acumulado y visitas.",
    fields: [
      { name: "clientCode", type: "String", key: "PK lógica", example: "SA-4092" },
      { name: "name", type: "String", key: "—" },
      { name: "email / phone", type: "String", key: "—" },
      { name: "isPlatinum", type: "Boolean", key: "—" },
      { name: "totalSpent / visitsCount / averageTicket", type: "Number", key: "métricas" },
      { name: "styleProfile", type: "Object { bio, tags }", key: "—" },
      { name: "alerts", type: "[String]", key: "—" },
      { name: "createdAt / updatedAt", type: "Date", key: "timestamps" },
    ],
    usedBy: ["Agenda", "Perfil cliente", "Reservas", "Caja (snapshot en pago)"],
  },
  {
    model: "PosStaff",
    collection: "posstaffs",
    domain: "POS Salón",
    purpose: "Manicuristas: turno, comisión, servicios permitidos y PIN de login.",
    fields: [
      { name: "staffCode", type: "String", key: "PK lógica", example: "CA" },
      { name: "name / role / specialty", type: "String", key: "—" },
      { name: "status", type: "enum", key: "online | offline | break" },
      { name: "commissionPercent", type: "Number", key: "—" },
      { name: "allowedServiceIds", type: "[String]", key: "catálogo local" },
      { name: "loginCode", type: "String", key: "sensible", sensitive: true },
      { name: "completedToday / totalToday", type: "Number", key: "métricas día" },
    ],
    usedBy: ["Agenda", "Login manicurista", "Bloqueos", "Citas"],
  },
  {
    model: "PosReceptionist",
    collection: "posreceptionists",
    domain: "POS Salón",
    purpose: "Recepcionistas con PIN individual para login, reservas y caja.",
    fields: [
      { name: "receptionistCode", type: "String", key: "PK lógica", example: "RC" },
      { name: "name / role", type: "String", key: "—" },
      { name: "loginCode", type: "String", key: "sensible", sensitive: true },
      { name: "bookingsToday / bookingsTodayDate", type: "Number + String", key: "contador diario" },
    ],
    usedBy: ["Login recepción", "Reservas", "Caja", "Auditoría"],
  },
  {
    model: "PosAppointment",
    collection: "posappointments",
    domain: "POS Salón",
    purpose: "Citas: servicio, horario, estado y vínculos a cliente y staff.",
    fields: [
      { name: "appointmentCode", type: "String", key: "PK lógica", example: "APT-…" },
      { name: "date / time", type: "String", key: "índice agenda" },
      { name: "serviceName (+ subtitle, image)", type: "String", key: "puede ser varios con +" },
      { name: "clientId / clientName", type: "String", key: "FK → PosClient" },
      { name: "staffId / staffName / staffInitials", type: "String", key: "FK → PosStaff" },
      { name: "cost / duration", type: "Number", key: "—" },
      { name: "status", type: "enum", key: "agendado | confirmado | pagado | cancelled" },
      { name: "bookedByReceptionistId", type: "String", key: "FK → PosReceptionist" },
    ],
    usedBy: ["Agenda", "Caja", "Estadísticas diarias"],
  },
  {
    model: "PosBlockedSlot",
    collection: "posblockedslots",
    domain: "POS Salón",
    purpose: "Horarios bloqueados por manicurista (descanso, comida, etc.).",
    fields: [
      { name: "blockedSlotCode", type: "String", key: "PK lógica" },
      { name: "date / time / duration", type: "String + Number", key: "índice" },
      { name: "staffId", type: "String", key: "FK → PosStaff" },
      { name: "reason", type: "String", key: "—" },
    ],
    usedBy: ["Agenda (columnas manicurista)"],
  },
  {
    model: "PosPayment",
    collection: "pospayments",
    domain: "POS Salón",
    purpose: "Cobros registrados en caja por cita.",
    fields: [
      { name: "paymentCode", type: "String", key: "PK lógica" },
      { name: "appointmentCode", type: "String", key: "FK → PosAppointment" },
      { name: "appointmentDate", type: "String", key: "filtro día" },
      { name: "amount / tip / total", type: "Number", key: "—" },
      { name: "method", type: "enum", key: "efectivo | tarjeta | transferencia | mixto" },
      { name: "cashAmount / cardAmount / transferAmount", type: "Number", key: "si mixto" },
      { name: "cashSessionCode", type: "String", key: "FK → PosCashSession" },
      { name: "processedByReceptionistId", type: "String", key: "FK → PosReceptionist" },
    ],
    usedBy: ["Caja", "Totales de turno", "Historial de cortes"],
  },
  {
    model: "PosCashSession",
    collection: "poscashsessions",
    domain: "POS Salón",
    purpose: "Turnos de caja: apertura, cobros agregados y corte de caja.",
    fields: [
      { name: "sessionCode", type: "String", key: "PK lógica", example: "CS-…" },
      { name: "status", type: "enum", key: "open | closed" },
      { name: "shiftDate", type: "String", key: "—" },
      { name: "openingFloat", type: "Number", key: "fondo inicial" },
      { name: "expectedCash/Card/Transfer", type: "Number", key: "al cerrar" },
      { name: "closingCountedCash/Card/Transfer", type: "Number", key: "conteo físico" },
      { name: "variance / cardVariance / transferVariance", type: "Number", key: "diferencias" },
      { name: "isPerfectCut", type: "Boolean", key: "—" },
      { name: "paymentsCount / totalAmount / totalEfectivo…", type: "Number", key: "agregados" },
    ],
    usedBy: ["Caja", "Corte", "Historial", "Auditoría"],
  },
  {
    model: "PosLoginAudit",
    collection: "posloginaudits",
    domain: "POS Salón",
    purpose: "Bitácora de logins y acciones de caja (quién, cuándo, éxito).",
    fields: [
      { name: "role", type: "enum", key: "reception | manicurista | master" },
      { name: "userId / userName", type: "String", key: "—" },
      { name: "action", type: "String", key: "login | caja_open | caja_close | …" },
      { name: "cashSessionCode", type: "String", key: "FK → PosCashSession" },
      { name: "actionDetails", type: "Mixed", key: "snapshot montos en cierre" },
      { name: "success / errorMessage", type: "Boolean + String", key: "—" },
    ],
    usedBy: ["Panel master", "Trazabilidad caja"],
  },
  {
    model: "PosDailySnapshot",
    collection: "posdailysnapshots",
    domain: "POS Salón",
    purpose: "Resumen por fecha: citas, sin confirmar, pagadas, canceladas.",
    fields: [
      { name: "date", type: "String", key: "PK lógica" },
      { name: "citas / sinConfirmar / pagadas / canceladas", type: "Number", key: "contadores" },
    ],
    usedBy: ["Barra sticky de agenda"],
  },
  {
    model: "PosScheduleConfig",
    collection: "posscheduleconfigs",
    domain: "POS Salón",
    purpose: "Configuración global del horario y clave master del admin.",
    fields: [
      { name: "configCode", type: "String", key: "default = singleton" },
      { name: "startHour / endHour / slotIntervalMinutes", type: "Number", key: "agenda" },
      { name: "bookingDurationOptions / closeDurationOptions", type: "[Number]", key: "—" },
      { name: "closeReasons", type: "[String]", key: "bloqueos" },
      { name: "timeZone", type: "String", key: "—" },
      { name: "masterLoginCode", type: "String", key: "sensible", sensitive: true },
    ],
    usedBy: ["Agenda", "Login master", "Validación PIN admin"],
  },
  {
    model: "User",
    collection: "users",
    domain: "ShipFast (SaaS)",
    purpose: "Usuarios de la app web con Stripe y NextAuth (fuera del POS en salón).",
    fields: [
      { name: "email / name", type: "String", key: "—" },
      { name: "role", type: "enum", key: "user | admin | editor | moderator" },
      { name: "customerId / priceId / hasAccess", type: "String + Boolean", key: "Stripe" },
    ],
    usedBy: ["Dashboard SaaS", "Webhooks Stripe"],
  },
  {
    model: "Lead",
    collection: "leads",
    domain: "ShipFast (SaaS)",
    purpose: "Emails capturados desde landing (waitlist).",
    fields: [{ name: "email", type: "String", key: "PK lógica" }],
    usedBy: ["Landing / ButtonLead"],
  },
];

export const FLOW_STEPS = [
  {
    title: "Login recepción o manicurista",
    steps: [
      "PosReceptionist.loginCode o PosStaff.loginCode se valida en /api/pos/login/verify.",
      "Si el PIN coincide con PosScheduleConfig.masterLoginCode → rol master.",
      "Cada intento se registra en PosLoginAudit.",
      "Al entrar recepción se abre PosCashSession si no hay turno abierto.",
    ],
  },
  {
    title: "Reserva y agenda",
    steps: [
      "Se crea PosAppointment con clientId → PosClient y staffId → PosStaff.",
      "bookedByReceptionistId enlaza a PosReceptionist.",
      "PosBlockedSlot evita solapamientos en la columna de la manicurista.",
      "PosDailySnapshot se actualiza con contadores por date.",
    ],
  },
  {
    title: "Cobro y corte",
    steps: [
      "PosPayment se crea con appointmentCode y cashSessionCode del turno abierto.",
      "PosAppointment.status pasa a pagado; totales se agregan en PosCashSession.",
      "Al cerrar turno se guardan conteos, varianzas e isPerfectCut.",
      "PosLoginAudit.actionDetails guarda snapshot de montos en caja_close.",
    ],
  },
];

const SENSITIVE_KEYS = new Set([
  "logincode",
  "masterlogincode",
  "pin",
  "password",
  "secret",
]);

export function maskSensitiveValue(key, value) {
  if (value == null || value === "") return value;
  if (!SENSITIVE_KEYS.has(String(key).toLowerCase())) return value;
  return "••••";
}

export function maskDocument(doc) {
  if (!doc || typeof doc !== "object") return doc;

  const masked = Array.isArray(doc) ? [] : {};

  for (const [key, value] of Object.entries(doc)) {
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      masked[key] = maskDocument(value);
    } else if (Array.isArray(value)) {
      masked[key] = value.map((item) =>
        typeof item === "object" ? maskDocument(item) : item
      );
    } else {
      masked[key] = maskSensitiveValue(key, value);
    }
  }

  return masked;
}
