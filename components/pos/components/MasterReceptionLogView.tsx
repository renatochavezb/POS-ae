"use client";

import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  Sparkles,
  Award,
  ArrowLeft,
  Shield
} from 'lucide-react';
import { Appointment, Receptionist } from '../types';
import { formatServicePrice } from '../data';
import { getAppointmentStatusLabel, getAppointmentStatusStyles } from '../appointmentStatus';
import {
  addDays,
  formatAppointmentTimeRange,
  formatSpanishShortDate,
  getTodaySpanishShortDate
} from '../scheduleUtils';

interface MasterReceptionLogViewProps {
  appointments: Appointment[];
  receptionists: Receptionist[];
  onBack: () => void;
}

export default function MasterReceptionLogView({
  appointments,
  receptionists,
  onBack
}: MasterReceptionLogViewProps) {
  const [selectedBookedDate, setSelectedBookedDate] = useState<Date>(() => new Date());

  const selectedBookedLabel = formatSpanishShortDate(selectedBookedDate);
  const isToday = selectedBookedLabel === getTodaySpanishShortDate();

  const bookedAppointments = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            appointment.bookedByReceptionistId &&
            appointment.bookedOnDate === selectedBookedLabel
        )
        .sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, selectedBookedLabel]
  );

  const receptionistColumns = useMemo(
    () =>
      receptionists.map((member) => ({
        member,
        appointments: bookedAppointments.filter(
          (appointment) => appointment.bookedByReceptionistId === member.id
        )
      })),
    [bookedAppointments, receptionists]
  );

  const handlePrevDay = () => {
    setSelectedBookedDate((prev) => addDays(prev, -1));
  };

  const handleNextDay = () => {
    setSelectedBookedDate((prev) => addDays(prev, 1));
  };

  const handleGoToday = () => {
    setSelectedBookedDate(new Date());
  };

  return (
    <div className="space-y-8 animate-fade-in p-1 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-outline hover:text-primary mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-secondary" />
            <span className="text-secondary font-sans text-xs font-bold tracking-widest uppercase">
              Panel maestro
            </span>
          </div>
          <h2 className="font-display text-3xl font-bold text-primary mt-1">
            Registro de citas por recepción
          </h2>
          <p className="text-on-surface-variant text-sm mt-1 max-w-2xl">
            Citas agendadas por recepcionistas agrupadas por el día en que se anotaron,
            no por la fecha del servicio.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-surface-container-lowest border border-primary/5 rounded-2xl p-2 luxury-shadow">
          <button
            type="button"
            onClick={handlePrevDay}
            className="p-2 rounded-lg hover:bg-surface-container-low text-primary"
            title="Día anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-4 text-center min-w-[160px]">
            <p className="text-[10px] text-outline font-bold uppercase tracking-wider">
              Día de anotación
            </p>
            <p className="text-sm font-bold text-primary">{selectedBookedLabel}</p>
            {isToday && (
              <p className="text-[9px] text-secondary font-bold uppercase tracking-wider mt-0.5">
                Hoy
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleNextDay}
            className="p-2 rounded-lg hover:bg-surface-container-low text-primary"
            title="Día siguiente"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          {!isToday && (
            <button
              type="button"
              onClick={handleGoToday}
              className="ml-1 px-3 py-2 rounded-lg bg-primary text-on-primary text-[10px] font-bold uppercase tracking-wider"
            >
              Hoy
            </button>
          )}
        </div>
      </div>

      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-primary/5 luxury-shadow">
        <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">
          Total anotadas
        </p>
        <p className="font-display text-4xl font-black text-primary">{bookedAppointments.length}</p>
        <p className="text-xs text-on-surface-variant mt-1">En {selectedBookedLabel}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {receptionistColumns.map(({ member, appointments: memberAppointments }) => (
          <div
            key={member.id}
            className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden"
            style={{ borderTop: `3px solid ${member.color}` }}
          >
            <div className="p-5 border-b border-primary/5 bg-surface-container-low/30">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-outline font-bold uppercase tracking-wider">
                    Recepcionista
                  </p>
                  <h3 className="font-display text-lg font-black text-primary truncate">
                    {member.name}
                  </h3>
                </div>
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shrink-0"
                  style={{
                    borderColor: member.color,
                    backgroundColor: member.colorLight,
                    color: member.color,
                  }}
                >
                  {member.id}
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="font-display text-4xl font-black text-primary">
                    {memberAppointments.length}
                  </p>
                  <p className="text-[10px] text-outline font-bold uppercase tracking-wider">
                    Citas registradas
                  </p>
                </div>
                <p className="text-[10px] text-on-surface-variant text-right">
                  {selectedBookedLabel}
                </p>
              </div>
            </div>

            <div className="p-3 space-y-3">
              {memberAppointments.length === 0 ? (
                <div className="rounded-xl border border-primary/5 bg-surface-container-low/30 p-4 text-center">
                  <p className="text-xs font-bold text-primary">Sin citas</p>
                  <p className="text-[10px] text-outline mt-1">
                    No registró citas este día.
                  </p>
                </div>
              ) : (
                memberAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-xl border border-primary/5 bg-surface p-3 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-primary truncate">
                          {appointment.clientName}
                        </p>
                        <p className="text-[10px] text-outline font-mono">{appointment.clientId}</p>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                          getAppointmentStatusStyles(appointment.status).badgeClass
                        }`}
                      >
                        {getAppointmentStatusLabel(appointment.status)}
                      </span>
                    </div>

                    <div className="space-y-2 text-[10px]">
                      <div>
                        <p className="text-outline font-bold uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Servicio
                        </p>
                        <p className="text-xs font-bold text-primary mt-0.5">
                          {appointment.serviceName}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-outline font-bold uppercase tracking-wider flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            Especialista
                          </p>
                          <p className="text-xs font-bold text-primary mt-0.5">
                            {appointment.staffName}
                          </p>
                        </div>
                        <div>
                          <p className="text-outline font-bold uppercase tracking-wider flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" />
                            Horario
                          </p>
                          <p className="text-xs font-mono font-bold text-primary mt-0.5">
                            {formatAppointmentTimeRange(appointment.time, appointment.duration)}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-primary/5 flex items-center justify-between gap-2">
                        <span className="text-outline">{appointment.date}</span>
                        <span className="font-bold text-primary">
                          {formatServicePrice(appointment.cost)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {bookedAppointments.length === 0 && (
        <div className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow p-10 text-center">
          <CalendarClock className="w-10 h-10 text-outline mx-auto mb-3" />
          <p className="font-display text-lg font-bold text-primary">
            Sin citas anotadas este día
          </p>
          <p className="text-sm text-on-surface-variant mt-1">
            Las citas aparecen aquí el día en que la recepcionista las agenda.
          </p>
        </div>
      )}

    </div>
  );
}
