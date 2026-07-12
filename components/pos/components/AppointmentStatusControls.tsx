import {
  getAppointmentStatusLabel,
  getAppointmentStatusStyles,
  getNextAppointmentStatus,
  isAppointmentStatusFinal,
  normalizeAppointmentStatus,
} from '../appointmentStatus';
import { AppointmentStatus } from '../types';
import { CheckCircle2 } from 'lucide-react';

interface AppointmentStatusControlsProps {
  status: AppointmentStatus;
  onChange: (status: AppointmentStatus) => void;
  compact?: boolean;
  accentColor?: string;
  readOnly?: boolean;
}

export default function AppointmentStatusControls({
  status,
  onChange,
  compact = false,
  accentColor,
  readOnly = false,
}: AppointmentStatusControlsProps) {
  const normalized = normalizeAppointmentStatus(status);
  const styles = getAppointmentStatusStyles(normalized);
  const nextStatus = getNextAppointmentStatus(status);
  const label = getAppointmentStatusLabel(status);

  if (readOnly || isAppointmentStatusFinal(status)) {
    return (
      <span
        className={`inline-flex items-center justify-center gap-1 rounded font-bold uppercase tracking-wider ${
          compact ? 'text-[8px] px-1.5 py-0.5 w-full' : 'text-[10px] px-2.5 py-1'
        } ${styles.activeClass}`}
        title="Cita bloqueada"
      >
        <CheckCircle2 className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        {label}
      </span>
    );
  }

  const useAccentColor = normalized === 'agendado' && accentColor;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        if (nextStatus) onChange(nextStatus);
      }}
      disabled={!nextStatus}
      title={
        nextStatus
          ? `Cambiar a ${getAppointmentStatusLabel(nextStatus)}`
          : label
      }
      className={`inline-flex items-center justify-center gap-1 rounded font-bold uppercase tracking-wider transition-all ${
        compact ? 'text-[8px] px-1.5 py-0.5 w-full' : 'text-[10px] px-3 py-1.5'
      } ${styles.activeClass} ${nextStatus ? 'hover:opacity-90 cursor-pointer' : 'cursor-default opacity-95'}`}
      style={useAccentColor ? { backgroundColor: accentColor } : undefined}
    >
      <CheckCircle2 className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {label}
    </button>
  );
}
