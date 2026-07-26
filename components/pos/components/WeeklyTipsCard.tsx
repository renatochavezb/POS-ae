"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, HandCoins } from "lucide-react";
import { formatMXN } from "../data";
import { addDays, getStudioWeekStart } from "../scheduleUtils";
import { useWeeklySnapshot } from "../useWeeklySnapshot";

export default function WeeklyTipsCard() {
  const [weekStart, setWeekStart] = useState<Date>(() => getStudioWeekStart(new Date()));
  const [showDetails, setShowDetails] = useState(false);
  const { snapshot, isLoading, weekRangeLabel, viewingCurrentWeek } = useWeeklySnapshot(weekStart);

  const previousWeekStart = useMemo(() => addDays(weekStart, -7), [weekStart]);
  const { snapshot: previousSnapshot } = useWeeklySnapshot(previousWeekStart);

  const weekTips = snapshot?.tips ?? 0;
  const previousTips = previousSnapshot?.tips ?? 0;
  const deltaPercent =
    previousTips > 0 ? Math.round(((weekTips - previousTips) / previousTips) * 100) : null;

  const byStaff = useMemo(() => {
    const rows = (snapshot?.salesByStaff || [])
      .map((entry) => ({
        staffId: entry.staffId,
        staffName: entry.staffName,
        tips: entry.tips ?? 0,
        sales: entry.sales ?? 0,
      }))
      .filter((entry) => entry.tips > 0)
      .sort((a, b) => b.tips - a.tips || a.staffName.localeCompare(b.staffName));
    return rows;
  }, [snapshot]);

  const byDay = useMemo(() => {
    const days = snapshot?.salesByDay?.length ? snapshot.salesByDay : snapshot?.completedByDay || [];
    return days.map((day) => ({
      dayLabel: day.dayLabel,
      dateLabel: day.dateLabel,
      tips: day.tips ?? 0,
    }));
  }, [snapshot]);

  return (
    <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 flex-1">
        <div className="space-y-3 min-w-0 flex-1">
          <span className="text-[10px] text-outline font-bold tracking-widest uppercase block">
            Propinas de la semana
          </span>

          <div className="flex items-center justify-between gap-2 max-w-md">
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

          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-display text-4xl font-extrabold text-primary">
              {isLoading ? "—" : formatMXN(weekTips)}
            </span>
            {!isLoading && deltaPercent !== null && (
              <span
                className={`text-xs font-bold font-sans ${
                  deltaPercent >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {deltaPercent >= 0 ? "+" : ""}
                {deltaPercent}% vs sem. ant.
              </span>
            )}
          </div>

          <p className="text-xs text-on-surface-variant">
            Total de propinas cobradas · Mongo · control para admin y liquidación.
          </p>

          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="text-[10px] font-sans font-bold uppercase tracking-wider text-secondary hover:text-primary transition-colors"
          >
            {showDetails ? "Ocultar detalle" : "Ver por manicurista"}
          </button>
        </div>

        <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
          <HandCoins className="w-6 h-6 text-secondary" />
        </div>
      </div>

      {showDetails ? (
        <div className="mt-5 pt-4 border-t border-primary/5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-2">
              Por manicurista
            </p>
            {byStaff.length === 0 ? (
              <p className="text-xs text-outline">Sin propinas registradas esta semana.</p>
            ) : (
              <ul className="space-y-2">
                {byStaff.map((row) => (
                  <li
                    key={row.staffId}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="font-bold text-primary truncate">{row.staffName}</span>
                    <span className="font-mono font-bold text-secondary shrink-0">
                      {formatMXN(row.tips)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-2">
              Por día
            </p>
            <ul className="space-y-2">
              {byDay.map((day) => (
                <li
                  key={day.dateLabel || day.dayLabel}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="text-outline">
                    <span className="font-bold text-primary">{day.dayLabel}</span>
                    <span className="ml-1.5 text-[10px]">{day.dateLabel}</span>
                  </span>
                  <span className="font-mono font-bold text-primary shrink-0">
                    {formatMXN(day.tips)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
