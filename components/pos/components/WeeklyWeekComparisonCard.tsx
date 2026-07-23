"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Loader2 } from "lucide-react";
import { formatMXN } from "../data";
import { addDays } from "../scheduleUtils";
import { useWeeklySnapshot } from "../useWeeklySnapshot";
import { WeeklyBreakdownDay, WeeklyStats } from "../types";

type WeeklyWeekComparisonCardProps = {
  weekStart: Date;
};

type MetricId = "citas" | "bruta" | "comision" | "neta";

type DayCompareRow = {
  key: string;
  dayLabel: string;
  dateLabel: string;
  citasPrev: number;
  citasAct: number;
  brutaPrev: number;
  brutaAct: number;
  comisionPrev: number;
  comisionAct: number;
  netaPrev: number;
  netaAct: number;
};

const METRICS: {
  id: MetricId;
  label: string;
  money: boolean;
  prevKey: keyof DayCompareRow;
  actKey: keyof DayCompareRow;
  totalPrev: "citasPrev" | "brutaPrev" | "comisionPrev" | "netaPrev";
  totalAct: "citasAct" | "brutaAct" | "comisionAct" | "netaAct";
}[] = [
  {
    id: "citas",
    label: "Citas",
    money: false,
    prevKey: "citasPrev",
    actKey: "citasAct",
    totalPrev: "citasPrev",
    totalAct: "citasAct",
  },
  {
    id: "bruta",
    label: "Venta bruta",
    money: true,
    prevKey: "brutaPrev",
    actKey: "brutaAct",
    totalPrev: "brutaPrev",
    totalAct: "brutaAct",
  },
  {
    id: "comision",
    label: "Comisión",
    money: true,
    prevKey: "comisionPrev",
    actKey: "comisionAct",
    totalPrev: "comisionPrev",
    totalAct: "comisionAct",
  },
  {
    id: "neta",
    label: "Venta neta",
    money: true,
    prevKey: "netaPrev",
    actKey: "netaAct",
    totalPrev: "netaPrev",
    totalAct: "netaAct",
  },
];

function dayNet(day?: WeeklyBreakdownDay | null) {
  if (!day) return 0;
  if (day.net != null && Number.isFinite(day.net)) return day.net;
  return (day.sales || 0) - (day.commission || 0) - (day.tips || 0);
}

function buildRows(
  current: WeeklyStats | null,
  previous: WeeklyStats | null
): DayCompareRow[] {
  const currentDays = current?.salesByDay?.length
    ? current.salesByDay
    : current?.completedByDay || [];
  const previousDays = previous?.salesByDay?.length
    ? previous.salesByDay
    : previous?.completedByDay || [];

  const length = Math.max(currentDays.length, previousDays.length, 7);

  return Array.from({ length }, (_, index) => {
    const act = currentDays[index];
    const prev = previousDays[index];
    return {
      key: act?.dateLabel || prev?.dateLabel || `day-${index}`,
      dayLabel: act?.dayLabel || prev?.dayLabel || `Día ${index + 1}`,
      dateLabel: act?.dateLabel || "",
      citasPrev: prev?.count ?? 0,
      citasAct: act?.count ?? 0,
      brutaPrev: prev?.sales ?? 0,
      brutaAct: act?.sales ?? 0,
      comisionPrev: prev?.commission ?? 0,
      comisionAct: act?.commission ?? 0,
      netaPrev: dayNet(prev),
      netaAct: dayNet(act),
    };
  });
}

function formatValue(value: number, money: boolean) {
  return money ? formatMXN(value) : String(value);
}

function formatDelta(current: number, previous: number, money: boolean) {
  const delta = current - previous;
  if (delta === 0) return money ? formatMXN(0) : "0";
  const sign = delta > 0 ? "+" : "−";
  const abs = Math.abs(delta);
  return `${sign}${money ? formatMXN(abs) : abs}`;
}

function deltaTone(current: number, previous: number) {
  if (current === previous) return "text-outline";
  return current > previous ? "text-emerald-700" : "text-red-700";
}

function DualBars({
  previous,
  current,
  max,
}: {
  previous: number;
  current: number;
  max: number;
}) {
  const safeMax = Math.max(max, 1);
  const prevPct = Math.min(100, (previous / safeMax) * 100);
  const actPct = Math.min(100, (current / safeMax) * 100);

  return (
    <div className="space-y-1.5 w-full min-w-0">
      <div className="h-2 rounded-full bg-surface-container-low overflow-hidden">
        <div
          className="h-full rounded-full bg-outline/35 transition-[width] duration-500"
          style={{ width: `${prevPct}%` }}
        />
      </div>
      <div className="h-2.5 rounded-full bg-surface-container-low overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${actPct}%` }}
        />
      </div>
    </div>
  );
}

export default function WeeklyWeekComparisonCard({ weekStart }: WeeklyWeekComparisonCardProps) {
  const [metric, setMetric] = useState<MetricId>("bruta");
  const previousWeekStart = useMemo(() => addDays(weekStart, -7), [weekStart]);
  const {
    snapshot: current,
    isLoading: loadingCurrent,
    weekRangeLabel: currentRange,
  } = useWeeklySnapshot(weekStart);
  const {
    snapshot: previous,
    isLoading: loadingPrevious,
    weekRangeLabel: previousRange,
  } = useWeeklySnapshot(previousWeekStart);

  const isLoading = loadingCurrent || loadingPrevious;
  const rows = useMemo(() => buildRows(current, previous), [current, previous]);

  const totals = useMemo(() => {
    if (current && previous) {
      return {
        citasPrev: previous.completedAppointmentsCount ?? 0,
        citasAct: current.completedAppointmentsCount ?? 0,
        brutaPrev: previous.grossSales ?? 0,
        brutaAct: current.grossSales ?? 0,
        comisionPrev: previous.estimatedCommission ?? 0,
        comisionAct: current.estimatedCommission ?? 0,
        netaPrev: previous.salonNet ?? 0,
        netaAct: current.salonNet ?? 0,
      };
    }

    return rows.reduce(
      (acc, row) => ({
        citasPrev: acc.citasPrev + row.citasPrev,
        citasAct: acc.citasAct + row.citasAct,
        brutaPrev: acc.brutaPrev + row.brutaPrev,
        brutaAct: acc.brutaAct + row.brutaAct,
        comisionPrev: acc.comisionPrev + row.comisionPrev,
        comisionAct: acc.comisionAct + row.comisionAct,
        netaPrev: acc.netaPrev + row.netaPrev,
        netaAct: acc.netaAct + row.netaAct,
      }),
      {
        citasPrev: 0,
        citasAct: 0,
        brutaPrev: 0,
        brutaAct: 0,
        comisionPrev: 0,
        comisionAct: 0,
        netaPrev: 0,
        netaAct: 0,
      }
    );
  }, [current, previous, rows]);

  const activeMetric = METRICS.find((item) => item.id === metric) || METRICS[1];

  const dayMax = useMemo(() => {
    return Math.max(
      1,
      ...rows.map((row) =>
        Math.max(Number(row[activeMetric.prevKey]) || 0, Number(row[activeMetric.actKey]) || 0)
      )
    );
  }, [rows, activeMetric]);

  return (
    <section className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden">
      <div className="p-5 md:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-primary">
              Comparativo semanal
            </h3>
            <p className="text-xs text-outline mt-1">
              Semana anterior frente a la semana seleccionada
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-outline">
              <span className="w-3 h-1.5 rounded-full bg-outline/35" />
              Ant. {previousRange}
            </span>
            <span className="inline-flex items-center gap-1.5 text-primary font-bold">
              <span className="w-3 h-2 rounded-full bg-primary" />
              Act. {currentRange}
            </span>
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-outline" /> : null}
          </div>
        </div>

        {/* Totales: 4 columnas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {METRICS.map((item) => {
            const prev = totals[item.totalPrev];
            const act = totals[item.totalAct];
            const selected = metric === item.id;
            const tone = deltaTone(act, prev);
            const Icon = act >= prev ? ArrowUpRight : ArrowDownRight;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMetric(item.id)}
                className={`text-left rounded-2xl border px-4 py-4 transition-colors ${
                  selected
                    ? "border-primary bg-primary text-on-primary"
                    : "border-primary/10 bg-surface hover:border-primary/25"
                }`}
              >
                <p
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    selected ? "text-on-primary/70" : "text-outline"
                  }`}
                >
                  {item.label}
                </p>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className={`text-[11px] ${
                        selected ? "text-on-primary/60" : "text-outline"
                      }`}
                    >
                      {formatValue(prev, item.money)}
                      <span className="mx-1 opacity-50">→</span>
                    </p>
                    <p
                      className={`font-display text-2xl font-extrabold leading-none truncate ${
                        selected ? "text-on-primary" : "text-primary"
                      }`}
                    >
                      {formatValue(act, item.money)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-0.5 text-[11px] font-bold shrink-0 ${
                      selected
                        ? act >= prev
                          ? "text-emerald-200"
                          : "text-red-200"
                        : tone
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {formatDelta(act, prev, item.money)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Día a día de la métrica seleccionada */}
        <div className="rounded-2xl border border-primary/8 bg-surface-container-low/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-primary/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs font-bold text-primary">
              Por día · {activeMetric.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {METRICS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMetric(item.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    metric === item.id
                      ? "bg-primary text-on-primary"
                      : "bg-surface text-outline border border-primary/10 hover:text-primary"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-primary/5">
            {rows.map((row) => {
              const prev = Number(row[activeMetric.prevKey]) || 0;
              const act = Number(row[activeMetric.actKey]) || 0;
              const tone = deltaTone(act, prev);

              return (
                <div
                  key={row.key}
                  className="px-4 py-3 grid grid-cols-1 md:grid-cols-[8.5rem_minmax(0,1fr)_auto] gap-3 md:gap-5 items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-primary">{row.dayLabel}</p>
                    <p className="text-[10px] text-outline">{row.dateLabel || "—"}</p>
                  </div>

                  <DualBars previous={prev} current={act} max={dayMax} />

                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 md:gap-0.5 md:min-w-[7.5rem]">
                    <div className="flex items-baseline gap-2 text-xs">
                      <span className="font-mono text-outline">{formatValue(prev, activeMetric.money)}</span>
                      <span className="text-outline/40">→</span>
                      <span className="font-mono font-bold text-primary">
                        {formatValue(act, activeMetric.money)}
                      </span>
                    </div>
                    <span className={`text-[11px] font-bold ${tone}`}>
                      {formatDelta(act, prev, activeMetric.money)}
                    </span>
                  </div>
                </div>
              );
            })}

            <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-[8.5rem_minmax(0,1fr)_auto] gap-3 md:gap-5 items-center bg-primary/5">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-wider text-primary">
                  Total
                </p>
                <p className="text-[10px] text-outline">Semana completa</p>
              </div>
              <DualBars
                previous={totals[activeMetric.totalPrev]}
                current={totals[activeMetric.totalAct]}
                max={Math.max(
                  totals[activeMetric.totalPrev],
                  totals[activeMetric.totalAct],
                  1
                )}
              />
              <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 md:gap-0.5 md:min-w-[7.5rem]">
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-mono text-outline">
                    {formatValue(totals[activeMetric.totalPrev], activeMetric.money)}
                  </span>
                  <span className="text-outline/40">→</span>
                  <span className="font-mono font-bold text-primary">
                    {formatValue(totals[activeMetric.totalAct], activeMetric.money)}
                  </span>
                </div>
                <span
                  className={`text-[11px] font-bold ${deltaTone(
                    totals[activeMetric.totalAct],
                    totals[activeMetric.totalPrev]
                  )}`}
                >
                  {formatDelta(
                    totals[activeMetric.totalAct],
                    totals[activeMetric.totalPrev],
                    activeMetric.money
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-outline">
          Barra gris = semana anterior · barra oscura = semana actual. Venta neta = bruta −
          comisión − propinas.
        </p>
      </div>
    </section>
  );
}
