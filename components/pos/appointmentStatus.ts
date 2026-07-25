import { AppointmentStatus } from './types';

export type AppointmentWorkflowStatus = 'agendado' | 'confirmado' | 'terminado';

export const APPOINTMENT_WORKFLOW_STATUSES: AppointmentWorkflowStatus[] = [
  'agendado',
  'confirmado',
  'terminado',
];

const STATUS_LABELS: Record<AppointmentWorkflowStatus, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  terminado: 'Terminado',
};

const STATUS_COMPACT_LABELS: Record<AppointmentWorkflowStatus, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  terminado: 'Terminado',
};

export const normalizeAppointmentStatus = (status?: string): AppointmentStatus => {
  if (status === 'pending') return 'agendado';
  // Legado: completed / pagado → terminado (el cobro real ocurre en caja)
  if (status === 'completed' || status === 'pagado') return 'terminado';
  if (
    status === 'agendado' ||
    status === 'confirmado' ||
    status === 'terminado' ||
    status === 'cancelled'
  ) {
    return status;
  }
  return 'agendado';
};

/** Cita finalizada en agenda (antes «pagado»; el cobro es en caja). */
export const isAppointmentFinished = (status: AppointmentStatus) =>
  normalizeAppointmentStatus(status) === 'terminado';

/** @deprecated Usar isAppointmentFinished — el cobro real ocurre en caja. */
export const isAppointmentPaid = isAppointmentFinished;

export const isAppointmentCancelled = (status: AppointmentStatus) =>
  normalizeAppointmentStatus(status) === 'cancelled';

export const isAppointmentPendingPayment = (status: AppointmentStatus) => {
  const normalized = normalizeAppointmentStatus(status);
  return normalized === 'agendado' || normalized === 'confirmado';
};

export const isAppointmentUnconfirmed = (status: AppointmentStatus) =>
  normalizeAppointmentStatus(status) === 'agendado';

/** Agendadas y canceladas pueden eliminarse del tablero. */
export const canDeleteAppointment = (status: AppointmentStatus) => {
  const normalized = normalizeAppointmentStatus(status);
  return normalized === 'agendado' || normalized === 'cancelled';
};

export const canCancelAppointment = (status: AppointmentStatus) =>
  normalizeAppointmentStatus(status) === 'agendado';

/** Solo citas agendadas pueden editarse (sin cambiar manicurista). */
export const canEditAppointment = (status: AppointmentStatus) =>
  normalizeAppointmentStatus(status) === 'agendado';

/** Confirmada o terminada: bloqueada para borrar y cancelar. */
export const isAppointmentLockedOnBoard = (status: AppointmentStatus) => {
  const normalized = normalizeAppointmentStatus(status);
  return normalized === 'confirmado' || normalized === 'terminado';
};

/** Estatus final: ya no avanza en el tablero. */
export const isAppointmentStatusFinal = (status: AppointmentStatus) => {
  const normalized = normalizeAppointmentStatus(status);
  return normalized === 'terminado' || normalized === 'cancelled';
};

export const getAppointmentStatusLabel = (status: AppointmentStatus) => {
  const normalized = normalizeAppointmentStatus(status);
  if (normalized === 'cancelled') return 'Cancelada';
  return STATUS_LABELS[normalized];
};

export const getAppointmentStatusCompactLabel = (status: AppointmentStatus) => {
  const normalized = normalizeAppointmentStatus(status);
  if (normalized === 'cancelled') return 'Cancelada';
  return STATUS_COMPACT_LABELS[normalized];
};

export const getNextAppointmentStatus = (
  status: AppointmentStatus
): AppointmentWorkflowStatus | null => {
  const normalized = normalizeAppointmentStatus(status);
  if (normalized === 'agendado') return 'confirmado';
  if (normalized === 'confirmado') return 'terminado';
  return null;
};

/** Retroceso de estatus (solo administrador). */
export const getPreviousAppointmentStatus = (
  status: AppointmentStatus
): AppointmentWorkflowStatus | null => {
  const normalized = normalizeAppointmentStatus(status);
  if (normalized === 'terminado') return 'confirmado';
  if (normalized === 'confirmado') return 'agendado';
  if (normalized === 'cancelled') return 'agendado';
  return null;
};

export const getAppointmentStatusStyles = (status: AppointmentStatus) => {
  const normalized = normalizeAppointmentStatus(status);

  if (normalized === 'confirmado') {
    return {
      activeClass: 'bg-sky-600 text-white',
      badgeClass: 'bg-sky-100 text-sky-900 border border-sky-200',
    };
  }

  if (normalized === 'terminado') {
    return {
      activeClass: 'bg-emerald-600 text-white',
      badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    };
  }

  if (normalized === 'cancelled') {
    return {
      activeClass: 'bg-red-600 text-white',
      badgeClass: 'bg-red-100 text-red-800 border border-red-200',
    };
  }

  return {
    activeClass: 'bg-amber-600 text-white',
    badgeClass: 'bg-amber-100 text-amber-900 border border-amber-200',
  };
};
