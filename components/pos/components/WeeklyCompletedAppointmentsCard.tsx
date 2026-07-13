"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Appointment, Staff } from "../types";
import { isAppointmentPaid } from "../appointmentStatus";
import {
  addDays,
  buildWeekDayEntries,
  formatWeekRangeLabel,
  getStudioWeekStart,
  isCurrentWeek,
} from "../scheduleUtils";

type WeeklyCompletedAppointmentsCardProps = {
  appointments: Appointment[];
  staffList: Staff[];
};

export default function WeeklyCompletedAppointmentsCard({
  appointments,
  staffList,
}: WeeklyCompletedAppointmentsCardProps) {
  const [weekStart, setWeekStart] = useState<Date>(() => getStudioWeekStart(new Date()));
  const [showDetails, setShowDetails] = useState(false);

  const weekDays = useMemo(() => buildWeekDayEntries(weekStart), [weekStart]);
  const weekDateLabels = useMemo(
    () => new Set(weekDays.map((day) => day.dateLabel)),
    [weekDays]
  );

  const weekCompleted = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          isAppointmentPaid(appointment.status) && weekDateLabels.has(appointment.date)
      ),
    [appointments, weekDateLabels]
  );

  const byDay = useMemo(
    () =>
      weekDays.map((day) => ({
        ...day,
        count: weekCompleted.filter((appointment) => appointment.date === day.dateLabel)
          .length,
      })),
    [weekDays, weekCompleted]
  );

  const byStaff = useMemo(() => {
    const staffNameById = new Map(staffList.map((member) => [member.id, member.name]));
    const counts = new Map<string, number>();

    weekCompleted.forEach((appointment) => {
      counts.set(appointment.staffId, (counts.get(appointment.staffId) ?? 0) + 1);
    });

    return [...counts.entries()]
      .map(([staffId, count]) => ({
        staffId,
        name: staffNameById.get(staffId) || appointmentStaffName(weekCompleted, staffId),
        count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [weekCompleted, staffList]);

  const weekTotal = weekCompleted.length;
  const weekRangeLabel = formatWeekRangeLabel(weekStart);
  const viewingCurrentWeek = isCurrentWeek(weekStart);

  const previousWeekLabels = useMemo(() => {
    const prevStart = addDays(weekStart, -7);
    return new Set(buildWeekDayEntries(prevStart).map((day) => day.dateLabel));
  }, [weekStart]);

  const previousWeekTotal = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          isAppointmentPaid(appointment.status) &&
          previousWeekLabels.has(appointment.date)
      ).length,
    [appointments, previousWeekLabels]
  );

  const weekDeltaPercent =
    previousWeekTotal > 0
      ? Math.round(((weekTotal - previousWeekTotal) / previousWeekTotal) * 100)
      : null;

  return (
    <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow h-full flex flex-col">
      <div className="flex items-start justify-between gap-4 flex-1">
        <div className="space-y-3 min-w-0 flex-1">
          <span className="text-[10px] text-outline font-bold tracking-widest uppercase block">
            Citas Finalizadas
          </span>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setWeekStart((prev) => addDays(prev, -7))}
              className="p-1.5 rounded-lg border border-primary/10 text-outline hover:text-primary hover:bg-surface-container-low transition-colors shrink-0"
              title="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0 text-center flex-1">
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider truncate">
                {viewingCurrentWeek ? "Semana en curso" : "Semana operativa"}
              </p>
              <p className="text-[11px] text-outline truncate">{weekRangeLabel}</p>
              <p className="text-[9px] text-outline/80 mt-0.5">Sábado a viernes</p>
            </div>
            <button
              type="button"
              onClick={() => setWeekStart((prev) => addDays(prev, 7))}
              className="p-1.5 rounded-lg border border-primary/10 text-outline hover:text-primary hover:bg-surface-container-low transition-colors shrink-0"
              title="Semana siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {!viewingCurrentWeek && (
            <button
              type="button"
              onClick={() => setWeekStart(getStudioWeekStart(new Date()))}
              className="text-[10px] font-sans font-bold uppercase tracking-wider text-secondary hover:text-primary transition-colors"
            >
              Volver a semana actual
            </button>
          )}

          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-extrabold text-primary">{weekTotal}</span>
            {weekDeltaPercent !== null && (
              <span
                className={`text-xs font-bold font-sans ${
                  weekDeltaPercent >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {weekDeltaPercent >= 0 ? "+" : ""}
                {weekDeltaPercent}% vs sem. ant.
              </span>
            )}
          </div>

          <p className="text-xs text-on-surface-variant">
            Citas pagadas · total semanal.
          </p>

          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="text-[10px] font-sans font-bold uppercase tracking-wider text-secondary hover:text-primary transition-colors"
          >
            {showDetails ? "Ocultar detalle" : "Ver por día y manicurista"}
          </button>
        </div>

        <div className="w-12 h-12 rounded-xl bg-emerald-500/5 flex items-center justify-center text-emerald-700 shrink-0">
          <CheckCircle2 className="w-6 h-6" />
        </div>
      </div>

      {showDetails && (
        <div className="mt-5 pt-5 border-t border-primary/5 space-y-4">
          <div>
            <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-2">
              Por día
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {byDay.map((day) => (
                <div
                  key={day.dateLabel}
                  className="rounded-lg border border-primary/10 bg-surface-container-low/40 px-1.5 py-2 text-center"
                >
                  <p className="text-[9px] text-outline font-bold uppercase">{day.dayLabel}</p>
                  <p className="text-sm font-display font-extrabold text-primary mt-0.5">
                    {day.count}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-2">
              Por manicurista
            </p>
            {byStaff.length === 0 ? (
              <p className="text-xs text-outline">Sin citas pagadas en esta semana.</p>
            ) : (
              <div className="space-y-1.5">
                {byStaff.map((member) => (
                  <div
                    key={member.staffId}
                    className="flex items-center justify-between gap-3 text-xs px-2 py-1.5 rounded-lg bg-surface-container-low/30"
                  >
                    <span className="font-sans font-bold text-primary truncate">{member.name}</span>
                    <span className="font-mono font-bold text-primary shrink-0">{member.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-primary/5 text-xs">
            <span className="text-outline font-bold uppercase tracking-wider">Total semana</span>
            <span className="font-display font-extrabold text-primary">{weekTotal}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function appointmentStaffName(appointments: Appointment[], staffId: string) {
  return (
    appointments.find((appointment) => appointment.staffId === staffId)?.staffName || staffId
  );
}
