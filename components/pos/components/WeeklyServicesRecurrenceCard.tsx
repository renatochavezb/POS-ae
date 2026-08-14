"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import posApi from "@/libs/posApi";
import { addDays, getStudioWeekStart } from "../scheduleUtils";
import { useWeeklySnapshot } from "../useWeeklySnapshot";
import { WeeklyServiceBreakdown, WeeklyStats } from "../types";
import { dashboardSectionDomId } from "../dashboardNav";

type ViewMode = "week" | "history";

function aggregateHistory(snapshots: WeeklyStats[]): WeeklyServiceBreakdown[] {
  const map = new Map<string, number>();
  snapshots.forEach((snapshot) => {
    (snapshot.servicesByCount || []).forEach((row) => {
      const name = (row.serviceName || "").trim();
      if (!name) return;
      map.set(name, (map.get(name) || 0) + (row.count || 0));
    });
  });
  return [...map.entries()]
    .map(([serviceName, count]) => ({ serviceName, count }))
    .sort((a, b) => b.count - a.count || a.serviceName.localeCompare(b.serviceName));
}

function ServiceRankList({
  rows,
  emptyLabel,
}: {
  rows: WeeklyServiceBreakdown[];
  emptyLabel: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  if (rows.length === 0) {
    return <p className="text-sm text-outline py-6 text-center">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
        const width = Math.max(6, (row.count / max) * 100);
        return (
          <div key={row.serviceName} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-bold text-primary min-w-0 truncate">
                <span className="text-outline font-mono mr-2">{index + 1}.</span>
                {row.serviceName}
              </p>
              <p className="text-xs font-mono font-bold text-primary shrink-0">
                {row.count}
                <span className="text-outline font-sans font-medium ml-1.5">{pct}%</span>
              </p>
            </div>
            <div className="h-2 rounded-full bg-surface-container-low overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function WeeklyServicesRecurrenceCard() {
  const [mode, setMode] = useState<ViewMode>("week");
  const [weekStart, setWeekStart] = useState<Date>(() => getStudioWeekStart(new Date()));
  const { snapshot, isLoading, weekRangeLabel, viewingCurrentWeek } = useWeeklySnapshot(weekStart);
  const [history, setHistory] = useState<WeeklyStats[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "history") return;
    let cancelled = false;

    const load = async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const result = await posApi.getWeeklyHistory();
        if (!cancelled) setHistory(result.snapshots || []);
      } catch (error) {
        console.error(error);
        if (!cancelled) setHistoryError("No se pudo cargar el histórico de servicios.");
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const weekRows = snapshot?.servicesByCount || [];
  const historyRows = useMemo(() => aggregateHistory(history), [history]);

  return (
    <section
      id={dashboardSectionDomId("servicios-recurrentes")}
      className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden scroll-mt-4"
    >
      <div className="p-5 md:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Servicios recurrentes
            </h3>
            <p className="text-xs text-outline mt-1">
              Lo que más se hace en citas terminadas. Combos se cuentan por cada servicio.
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-start rounded-xl border border-primary/10 bg-surface p-1">
            <button
              type="button"
              onClick={() => setMode("week")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                mode === "week"
                  ? "bg-primary text-on-primary"
                  : "text-outline hover:text-primary"
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setMode("history")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                mode === "history"
                  ? "bg-primary text-on-primary"
                  : "text-outline hover:text-primary"
              }`}
            >
              Histórico
            </button>
          </div>
        </div>

        {mode === "week" ? (
          <>
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
            {!viewingCurrentWeek ? (
              <button
                type="button"
                onClick={() => setWeekStart(getStudioWeekStart(new Date()))}
                className="text-[10px] font-sans font-bold uppercase tracking-wider text-secondary hover:text-primary transition-colors"
              >
                Volver a semana actual
              </button>
            ) : null}

            {isLoading ? (
              <div className="h-32 flex items-center justify-center text-sm text-outline">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Cargando servicios…
              </div>
            ) : (
              <ServiceRankList
                rows={weekRows}
                emptyLabel="No hay citas terminadas con servicio en esta semana."
              />
            )}
          </>
        ) : (
          <>
            <p className="text-[11px] text-outline">
              Suma de {history.length} {history.length === 1 ? "semana" : "semanas"} guardadas.
            </p>
            {historyError ? (
              <p className="text-sm text-red-700">{historyError}</p>
            ) : historyLoading ? (
              <div className="h-32 flex items-center justify-center text-sm text-outline">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Cargando histórico…
              </div>
            ) : (
              <ServiceRankList
                rows={historyRows}
                emptyLabel="Aún no hay semanas con servicios para sumar."
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
