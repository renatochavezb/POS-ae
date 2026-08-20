"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Target } from "lucide-react";
import posApi from "@/libs/posApi";
import { WeeklyStats } from "../types";
import { addDays, getStudioWeekStart } from "../scheduleUtils";
import { useWeeklySnapshot } from "../useWeeklySnapshot";
import {
  projectWeekCompletedAppointments,
  projectionConfidenceLabel,
} from "../weekAppointmentProjection";

type WeeklyCompletedAppointmentsCardProps = {
  /** Solo admin: proyección al cierre de la semana en curso. */
  showProjection?: boolean;
};

export default function WeeklyCompletedAppointmentsCard({
  showProjection = false,
}: WeeklyCompletedAppointmentsCardProps) {
  const [weekStart, setWeekStart] = useState<Date>(() => getStudioWeekStart(new Date()));
  const [showDetails, setShowDetails] = useState(false);
  const { snapshot, isLoading, weekRangeLabel, viewingCurrentWeek } = useWeeklySnapshot(weekStart);
  const [history, setHistory] = useState<WeeklyStats[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!showProjection || !viewingCurrentWeek) return;
    let cancelled = false;

    const load = async () => {
      setHistoryLoading(true);
      try {
        const result = await posApi.getWeeklyHistory();
        if (!cancelled) setHistory(result.snapshots || []);
      } catch (error) {
        console.error(error);
        if (!cancelled) setHistory([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [showProjection, viewingCurrentWeek]);

  const weekTotal = snapshot?.completedAppointmentsCount ?? 0;
  const weekDeltaPercent = snapshot?.completedWeekDeltaPercent ?? null;
  const byDay = snapshot?.completedByDay ?? [];
  const byStaff = snapshot?.completedByStaff ?? [];

  const projection = useMemo(() => {
    if (!showProjection || !viewingCurrentWeek || !snapshot) return null;
    return projectWeekCompletedAppointments({
      current: snapshot,
      history,
    });
  }, [showProjection, viewingCurrentWeek, snapshot, history]);

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
            <span className="font-display text-4xl font-extrabold text-primary">
              {isLoading ? "—" : weekTotal}
            </span>
            {!isLoading && weekDeltaPercent !== null && (
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
            Citas terminadas · KPI semanal en Mongo.
          </p>

          {showProjection && viewingCurrentWeek ? (
            <div className="rounded-xl border border-primary/10 bg-surface-container-low/40 px-3 py-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-secondary shrink-0" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                  Proyección al viernes
                </p>
              </div>
              {historyLoading && !projection ? (
                <p className="text-xs text-outline">Calculando con semanas previas…</p>
              ) : projection ? (
                <>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-display text-2xl font-extrabold text-primary">
                      ~{projection.projectedTotal}
                    </span>
                    <span className="text-[11px] text-outline font-medium">
                      rango {projection.rangeLow}–{projection.rangeHigh}
                    </span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant leading-snug">
                    Van {projection.cumulativeSoFar} hasta {projection.throughDayLabel}
                    {projection.historicalSharePct > 0
                      ? ` · hist. ~${projection.historicalSharePct}%`
                      : ""}
                    {" · "}
                    {projectionConfidenceLabel(projection.confidence)}
                    {projection.historyWeeksUsed > 0
                      ? ` (${projection.historyWeeksUsed} sem.)`
                      : ""}
                  </p>
                </>
              ) : (
                <p className="text-xs text-outline">
                  No hay suficiente historial para proyectar esta semana.
                </p>
              )}
            </div>
          ) : null}

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
              <p className="text-xs text-outline">Sin citas terminadas en esta semana.</p>
            ) : (
              <div className="space-y-1.5">
                {byStaff.map((member) => (
                  <div
                    key={member.staffId}
                    className="flex items-center justify-between gap-3 text-xs px-2 py-1.5 rounded-lg bg-surface-container-low/30"
                  >
                    <span className="font-sans font-bold text-primary truncate">{member.staffName}</span>
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
