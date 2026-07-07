"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { Appointment, ScheduleConfig } from "../types";
import {
  buildBookingTimeOptions,
  buildDayScheduleConfigForLabel,
  formatDuration,
  getDurationOptionsFromConfig,
  resolveScheduleForDateLabel,
} from "../scheduleUtils";

export type AppointmentEditPayload = {
  serviceName: string;
  serviceSubtitle: string;
  date: string;
  time: string;
  duration: number;
  cost: number;
};

type AppointmentEditModalProps = {
  appointment: Appointment;
  scheduleConfig: ScheduleConfig;
  isSubmitting?: boolean;
  error?: string | null;
  onConfirm: (payload: AppointmentEditPayload) => void;
  onClose: () => void;
};

export default function AppointmentEditModal({
  appointment,
  scheduleConfig,
  isSubmitting = false,
  error = null,
  onConfirm,
  onClose,
}: AppointmentEditModalProps) {
  const [serviceName, setServiceName] = useState(appointment.serviceName);
  const [serviceSubtitle, setServiceSubtitle] = useState(appointment.serviceSubtitle || "");
  const [date, setDate] = useState(appointment.date);
  const [time, setTime] = useState(appointment.time);
  const [duration, setDuration] = useState(appointment.duration ?? 60);
  const [cost, setCost] = useState(String(appointment.cost ?? 0));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setServiceName(appointment.serviceName);
    setServiceSubtitle(appointment.serviceSubtitle || "");
    setDate(appointment.date);
    setTime(appointment.time);
    setDuration(appointment.duration ?? 60);
    setCost(String(appointment.cost ?? 0));
  }, [appointment]);

  const daySchedule = useMemo(
    () => resolveScheduleForDateLabel(date, scheduleConfig),
    [date, scheduleConfig]
  );

  const dayConfig = useMemo(
    () => buildDayScheduleConfigForLabel(date, scheduleConfig),
    [date, scheduleConfig]
  );

  const timeOptions = useMemo(
    () => buildBookingTimeOptions(dayConfig),
    [dayConfig]
  );

  const durationOptions = useMemo(
    () => getDurationOptionsFromConfig(dayConfig, duration),
    [dayConfig, duration]
  );

  useEffect(() => {
    if (timeOptions.length > 0 && !timeOptions.includes(time)) {
      setTime(timeOptions[0]);
    }
  }, [timeOptions, time]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (!serviceName.trim()) {
      setLocalError("El servicio es obligatorio.");
      return;
    }

    if (!date.trim()) {
      setLocalError("La fecha es obligatoria.");
      return;
    }

    if (daySchedule.closed) {
      setLocalError("El salón está cerrado en la fecha seleccionada.");
      return;
    }

    if (!time) {
      setLocalError("Selecciona una hora.");
      return;
    }

    const parsedCost = Number(cost);
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      setLocalError("Ingresa un costo válido.");
      return;
    }

    onConfirm({
      serviceName: serviceName.trim(),
      serviceSubtitle: serviceSubtitle.trim(),
      date: date.trim(),
      time,
      duration,
      cost: parsedCost,
    });
  };

  const displayError = error || localError;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-surface max-w-md w-full rounded-2xl border border-primary/10 luxury-shadow overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-primary/5 flex items-start justify-between gap-3 sticky top-0 bg-surface z-10">
          <div>
            <span className="text-secondary font-sans text-[10px] font-extrabold uppercase tracking-widest block">
              Editar cita
            </span>
            <h3 className="font-display text-lg font-bold text-primary mt-0.5">
              {appointment.clientName}
            </h3>
            <p className="text-[10px] text-outline mt-1">
              La manicurista no se puede cambiar aquí. Para cambiarla, cancela la cita y crea una
              nueva.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-outline hover:text-primary transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-surface-container-low/50 border border-primary/5">
            <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">
              Manicurista (sin cambios)
            </p>
            <p className="text-sm font-bold text-primary">{appointment.staffName}</p>
            <p className="text-[10px] text-outline font-mono mt-0.5">{appointment.staffId}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
              Servicio
            </label>
            <input
              type="text"
              value={serviceName}
              onChange={(event) => setServiceName(event.target.value)}
              className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
              Detalle del servicio
            </label>
            <input
              type="text"
              value={serviceSubtitle}
              onChange={(event) => setServiceSubtitle(event.target.value)}
              placeholder="Servicio personalizado"
              className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans text-primary bg-surface outline-none focus:border-secondary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Fecha
              </label>
              <input
                type="text"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                placeholder="4 Jul, 2026"
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Hora
              </label>
              <select
                value={time}
                onChange={(event) => setTime(event.target.value)}
                disabled={daySchedule.closed}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary disabled:opacity-50"
                required
              >
                {timeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Duración
              </label>
              <select
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              >
                {durationOptions.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatDuration(minutes)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Costo (MXN)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              />
            </div>
          </div>

          {daySchedule.closed ? (
            <p className="text-[11px] text-red-600 font-medium">
              El salón está cerrado en la fecha seleccionada.
            </p>
          ) : (
            <p className="text-[10px] text-outline">
              Horario del día: {daySchedule.hoursLabel}
            </p>
          )}

          {displayError ? (
            <p className="text-xs text-red-600 flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {displayError}
            </p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-lg border border-primary/10 text-xs font-bold uppercase tracking-wider text-outline hover:bg-surface-container-low transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || daySchedule.closed}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
            >
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
