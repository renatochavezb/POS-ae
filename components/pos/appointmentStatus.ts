import { AppointmentStatus } from './types';

export type AppointmentWorkflowStatus = 'agendado' | 'confirmado' | 'pagado';

export const APPOINTMENT_WORKFLOW_STATUSES: AppointmentWorkflowStatus[] = [
  'agendado',
  'confirmado',
  'pagado',
];

const STATUS_LABELS: Record<AppointmentWorkflowStatus, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  pagado: 'Pagado',
};

const STATUS_COMPACT_LABELS: Record<AppointmentWorkflowStatus, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  pagado: 'Pagado',
};

export const normalizeAppointmentStatus = (status?: string): AppointmentStatus => {
  if (status === 'pending') return 'agendado';
  if (status === 'completed') return 'pagado';
  if (
    status === 'agendado' ||
    status === 'confirmado' ||
    status === 'pagado' ||
    status === 'cancelled'
  ) {
    return status;
  }
  return 'agendado';
};

export const isAppointmentPaid = (status: AppointmentStatus) =>
  normalizeAppointmentStatus(status) === 'pagado';

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

/** Confirmada o pagada: bloqueada para borrar y cancelar. */
export const isAppointmentLockedOnBoard = (status: AppointmentStatus) => {
  const normalized = normalizeAppointmentStatus(status);
  return normalized === 'confirmado' || normalized === 'pagado';
};

/** Estatus final: ya no avanza en el tablero. */
export const isAppointmentStatusFinal = (status: AppointmentStatus) => {
  const normalized = normalizeAppointmentStatus(status);
  return normalized === 'pagado' || normalized === 'cancelled';
};

export const getAppointmentStatusLabel = (status: AppointmentStatus) => {
  const normalized = normalizeAppointmentStatus(status);
  if (normalized === 'cancelled') return 'Cancelada';
  return STATUS_LABELS[normalized];
};

export const getNextAppointmentStatus = (
  status: AppointmentStatus
): AppointmentWorkflowStatus | null => {
  const normalized = normalizeAppointmentStatus(status);
  if (normalized === 'agendado') return 'confirmado';
  if (normalized === 'confirmado') return 'pagado';
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

  if (normalized === 'pagado') {
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
