"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  TrendingUp,
} from "lucide-react";
import posApi from "@/libs/posApi";
import { formatMXN } from "../data";
import {
  addDays,
  formatSpanishShortDate,
  formatWeekRangeLabel,
  getStudioWeekStart,
  isCurrentWeek,
} from "../scheduleUtils";
import {
  StaffPerformanceHistory,
  StaffPerformanceWeek,
  StaffWeekPerformance,
} from "../types";
import { dashboardSectionDomId } from "../dashboardNav";

type SortKey =
  | "staffName"
  | "citas"
  | "bruta"
  | "comision"
  | "tip"
  | "neta"
  | "ticketPromedio"
  | "deltaVsAvg";

type MetricId = "citas" | "bruta" | "comision" | "tip" | "neta" | "ticket";

type StaffPerformanceBoardProps = {
  initialWeekStart?: Date;
};

const METRICS: {
  id: MetricId;
  label: string;
  money: boolean;
  value: (r: StaffWeekPerformance) => number;
}[] = [
  { id: "citas", label: "Citas", money: false, value: (r) => r.citas },
  { id: "bruta", label: "Venta bruta", money: true, value: (r) => r.bruta },
  { id: "comision", label: "Comisión", money: true, value: (r) => r.comision },
  { id: "tip", label: "Propina", money: true, value: (r) => r.tip },
  { id: "neta", label: "Venta neta", money: true, value: (r) => r.neta },
  { id: "ticket", label: "Ticket promedio", money: true, value: (r) => r.ticketPromedio },
];

const VIEW_W = 760;
const VIEW_H = 260;
const M_LEFT = 52;
const M_RIGHT = 18;
const M_TOP = 18;
const M_BOTTOM = 34;
const PLOT_W = VIEW_W - M_LEFT - M_RIGHT;
const PLOT_H = VIEW_H - M_TOP - M_BOTTOM;

function formatValue(value: number, money: boolean) {
  return money ? formatMXN(value) : String(Math.round(value));
}

function formatCompact(value: number, money: boolean) {
  if (!money) return String(Math.round(value));
  if (value >= 1000) return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(value)}`;
}

function shortWeekLabel(weekStartDate: string) {
  const [dayMonth] = weekStartDate.split(",");
  return (dayMonth || weekStartDate).trim();
}

function niceMax(value: number) {
  if (value <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const scaled = value / pow;
  let step: number;
  if (scaled <= 1) step = 1;
  else if (scaled <= 2) step = 2;
  else if (scaled <= 5) step = 5;
  else step = 10;
  return step * pow;
}

function findWeek(
  weeks: StaffPerformanceWeek[],
  weekStartLabel: string
): StaffPerformanceWeek | null {
  return weeks.find((week) => week.weekStartDate === weekStartLabel) || null;
}

function previousWeekOf(
  weeks: StaffPerformanceWeek[],
  weekStartLabel: string
): StaffPerformanceWeek | null {
  const index = weeks.findIndex((week) => week.weekStartDate === weekStartLabel);
  if (index <= 0) return null;
  return weeks[index - 1];
}

function staffSeries(
  weeks: StaffPerformanceWeek[],
  staffId: string,
  metric: MetricId
): number[] {
  const metricDef = METRICS.find((item) => item.id === metric) || METRICS[1];
  return weeks.map((week) => {
    const row = week.staff.find((item) => item.staffId === staffId);
    return row ? metricDef.value(row) : 0;
  });
}

function averagePositive(values: number[]) {
  const usable = values.filter((value) => value > 0);
  if (usable.length === 0) return 0;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function Sparkline({ values, active }: { values: number[]; active?: boolean }) {
  const max = Math.max(1, ...values);
  const w = 72;
  const h = 22;
  const points = values
    .map((value, index) => {
      const x = values.length <= 1 ? w / 2 : (index / (values.length - 1)) * w;
      const y = h - (value / max) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="shrink-0 overflow-visible" aria-hidden>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
        className={active ? "text-on-primary" : "text-primary"}
      />
    </svg>
  );
}

function DeltaBadge({
  current,
  previous,
  money,
  inverted = false,
}: {
  current: number;
  previous: number;
  money?: boolean;
  inverted?: boolean;
}) {
  const delta = current - previous;
  if (delta === 0) {
    return <span className="text-[10px] font-bold text-outline">=</span>;
  }
  const up = delta > 0;
  const good = inverted ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
        good ? "text-emerald-700" : "text-red-700"
      }`}
    >
      <Icon className="w-3 h-3" />
      {up ? "+" : "−"}
      {money ? formatMXN(Math.abs(delta)) : Math.abs(Math.round(delta))}
    </span>
  );
}

export default function StaffPerformanceBoard({
  initialWeekStart,
}: StaffPerformanceBoardProps) {
  const [rankingWeekStart, setRankingWeekStart] = useState<Date>(
    () => initialWeekStart || getStudioWeekStart(new Date())
  );
  const [data, setData] = useState<StaffPerformanceHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("bruta");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [metric, setMetric] = useState<MetricId>("bruta");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const historyRef = useRef<HTMLElement | null>(null);

  const weekStartLabel = useMemo(
    () => formatSpanishShortDate(rankingWeekStart),
    [rankingWeekStart]
  );
  const rankingWeekRangeLabel = useMemo(
    () => formatWeekRangeLabel(rankingWeekStart),
    [rankingWeekStart]
  );
  const viewingCurrentWeek = isCurrentWeek(rankingWeekStart);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await posApi.getStaffPerformanceHistory();
        if (!cancelled) {
          setData(result);
          if (!selectedStaffId && result.staff?.length) {
            setSelectedStaffId(result.staff[0].staffId);
          }
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("No se pudo cargar el desempeño por manicurista.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weeks = useMemo(() => data?.weeks || [], [data]);

  const currentWeek = useMemo(() => {
    // Semana exacta seleccionada (sin saltar a otra si no hay datos).
    return findWeek(weeks, weekStartLabel);
  }, [weeks, weekStartLabel]);

  const previousWeek = useMemo(
    () => (currentWeek ? previousWeekOf(weeks, currentWeek.weekStartDate) : null),
    [weeks, currentWeek]
  );

  const rankingRows = useMemo(() => {
    if (!currentWeek) return [];

    return currentWeek.staff.map((row) => {
      const prev = previousWeek?.staff.find((item) => item.staffId === row.staffId);
      const brutaSeries = staffSeries(weeks, row.staffId, "bruta");
      const avgBruta = averagePositive(brutaSeries);
      const deltaVsAvgPct =
        avgBruta > 0 ? Math.round(((row.bruta - avgBruta) / avgBruta) * 100) : null;

      return {
        ...row,
        prev,
        sparkline: brutaSeries.slice(-8),
        avgBruta,
        deltaVsAvgPct,
        deltaVsAvgAbs: row.bruta - avgBruta,
      };
    });
  }, [currentWeek, previousWeek, weeks]);

  const sortedRows = useMemo(() => {
    const rows = [...rankingRows];
    rows.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === "staffName") {
        av = a.staffName;
        bv = b.staffName;
      } else if (sortKey === "deltaVsAvg") {
        av = a.deltaVsAvgPct ?? -9999;
        bv = b.deltaVsAvgPct ?? -9999;
      } else {
        av = Number(a[sortKey]) || 0;
        bv = Number(b[sortKey]) || 0;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return rows;
  }, [rankingRows, sortKey, sortDir]);

  const selectedStaff = useMemo(() => {
    if (!selectedStaffId) return null;
    return data?.staff.find((item) => item.staffId === selectedStaffId) || null;
  }, [data, selectedStaffId]);

  const activeMetric = METRICS.find((item) => item.id === metric) || METRICS[1];

  const chartSeries = useMemo(() => {
    if (!selectedStaffId) return [];
    return weeks.map((week) => {
      const row = week.staff.find((item) => item.staffId === selectedStaffId);
      return {
        label: shortWeekLabel(week.weekStartDate),
        rangeLabel: week.weekRangeLabel,
        value: row ? activeMetric.value(row) : 0,
        row: row || null,
      };
    });
  }, [weeks, selectedStaffId, activeMetric]);

  const selectedDetail =
    (hoverIndex != null ? chartSeries[hoverIndex]?.row : null) ||
    currentWeek?.staff.find((item) => item.staffId === selectedStaffId) ||
    chartSeries[chartSeries.length - 1]?.row ||
    null;

  const n = chartSeries.length;
  const maxValue = Math.max(0, ...chartSeries.map((point) => point.value));
  const maxY = niceMax(maxValue);
  const average = averagePositive(chartSeries.map((point) => point.value));
  const latest = n > 0 ? chartSeries[n - 1].value : 0;
  const previous = n > 1 ? chartSeries[n - 2].value : 0;
  const deltaPct =
    previous > 0 ? Math.round(((latest - previous) / previous) * 100) : null;

  const xFor = (index: number) =>
    n <= 1 ? M_LEFT + PLOT_W / 2 : M_LEFT + (index / (n - 1)) * PLOT_W;
  const yFor = (value: number) => M_TOP + PLOT_H - (value / maxY) * PLOT_H;
  const linePath = chartSeries
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(point.value).toFixed(1)}`
    )
    .join(" ");
  const areaPath =
    n > 0
      ? `${linePath} L ${xFor(n - 1).toFixed(1)} ${(M_TOP + PLOT_H).toFixed(1)} L ${xFor(0).toFixed(1)} ${(
          M_TOP + PLOT_H
        ).toFixed(1)} Z`
      : "";
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((factor) => maxY * factor);
  const labelStep = Math.max(1, Math.ceil(n / 8));

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "staffName" ? "asc" : "desc");
    }
  };

  const selectStaff = (staffId: string, scroll = false) => {
    setSelectedStaffId(staffId);
    if (scroll && historyRef.current) {
      historyRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handlePointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || n === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    const ratio = (relX - M_LEFT) / PLOT_W;
    const index = Math.round(ratio * (n - 1));
    setHoverIndex(Math.min(n - 1, Math.max(0, index)));
  };

  const SortHeader = ({
    label,
    column,
    align = "right",
  }: {
    label: string;
    column: SortKey;
    align?: "left" | "right";
  }) => (
    <button
      type="button"
      onClick={() => toggleSort(column)}
      className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${
        sortKey === column ? "text-primary" : "text-outline hover:text-primary"
      } ${align === "left" ? "text-left" : "text-right w-full"}`}
    >
      {label}
      {sortKey === column ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* —— SECCIÓN 1: Ranking —— */}
      <section
        id={dashboardSectionDomId("ranking-manicuristas")}
        className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden scroll-mt-4"
      >
        <div className="p-5 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
                <Users className="w-5 h-5" />
                Ranking de manicuristas
              </h3>
              <p className="text-xs text-outline mt-1">
                Comparativo de la semana seleccionada
                {isLoading ? (
                  <Loader2 className="inline w-3.5 h-3.5 ml-2 animate-spin" />
                ) : null}
              </p>
            </div>

            <div className="flex flex-col items-stretch sm:items-end gap-2">
              <div className="flex items-center justify-between gap-2 w-full sm:w-auto sm:min-w-[16rem]">
                <button
                  type="button"
                  onClick={() => setRankingWeekStart((prev) => addDays(prev, -7))}
                  className="p-1.5 rounded-lg border border-primary/10 text-outline hover:text-primary hover:bg-surface-container-low transition-colors shrink-0"
                  title="Semana anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0 text-center flex-1 px-1">
                  <p className="text-[10px] text-secondary font-bold uppercase tracking-wider truncate">
                    {viewingCurrentWeek ? "Semana en curso" : "Semana operativa"}
                  </p>
                  <p className="text-[11px] text-outline truncate">
                    {currentWeek?.weekRangeLabel || rankingWeekRangeLabel}
                  </p>
                  <p className="text-[9px] text-outline/80 mt-0.5">Sábado a viernes</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRankingWeekStart((prev) => addDays(prev, 7))}
                  className="p-1.5 rounded-lg border border-primary/10 text-outline hover:text-primary hover:bg-surface-container-low transition-colors shrink-0"
                  title="Semana siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {!viewingCurrentWeek ? (
                <button
                  type="button"
                  onClick={() => setRankingWeekStart(getStudioWeekStart(new Date()))}
                  className="text-[10px] font-sans font-bold uppercase tracking-wider text-secondary hover:text-primary transition-colors self-center sm:self-end"
                >
                  Volver a semana actual
                </button>
              ) : null}
              <p className="text-[10px] text-outline max-w-sm sm:text-right">
                Toca una fila para ver su histórico abajo. Δ promedio = vs su media de
                venta bruta.
              </p>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : isLoading && !data ? (
            <div className="h-32 flex items-center justify-center text-sm text-outline">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando ranking…
            </div>
          ) : sortedRows.length === 0 ? (
            <p className="text-sm text-outline py-8 text-center">
              No hay datos de manicuristas en esta semana.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b border-primary/10">
                    <th className="py-2 px-2 text-left">
                      <SortHeader label="Manicurista" column="staffName" align="left" />
                    </th>
                    <th className="py-2 px-2">
                      <SortHeader label="Citas" column="citas" />
                    </th>
                    <th className="py-2 px-2">
                      <SortHeader label="Bruta" column="bruta" />
                    </th>
                    <th className="py-2 px-2">
                      <SortHeader label="Comisión" column="comision" />
                    </th>
                    <th className="py-2 px-2">
                      <SortHeader label="Propina" column="tip" />
                    </th>
                    <th className="py-2 px-2">
                      <SortHeader label="Neta" column="neta" />
                    </th>
                    <th className="py-2 px-2">
                      <SortHeader label="Ticket" column="ticketPromedio" />
                    </th>
                    <th className="py-2 px-2">
                      <SortHeader label="Δ vs prom." column="deltaVsAvg" />
                    </th>
                    <th className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-outline text-right">
                      Tendencia
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, index) => {
                    const selected = selectedStaffId === row.staffId;
                    return (
                      <tr
                        key={row.staffId}
                        onClick={() => selectStaff(row.staffId, true)}
                        className={`border-b border-primary/5 cursor-pointer transition-colors ${
                          selected
                            ? "bg-primary text-on-primary"
                            : "hover:bg-surface-container-low/60"
                        }`}
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                selected
                                  ? "bg-on-primary/15 text-on-primary"
                                  : "bg-primary/10 text-primary"
                              }`}
                            >
                              {index + 1}
                            </span>
                            <span className="font-bold truncate">{row.staffName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-mono">
                          <div className="flex flex-col items-end gap-0.5">
                            <span>{row.citas}</span>
                            {row.prev ? (
                              <DeltaBadge current={row.citas} previous={row.prev.citas} />
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-mono">
                          <div className="flex flex-col items-end gap-0.5">
                            <span>{formatMXN(row.bruta)}</span>
                            {row.prev ? (
                              <DeltaBadge
                                current={row.bruta}
                                previous={row.prev.bruta}
                                money
                              />
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-mono">
                          {formatMXN(row.comision)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono">
                          <div className="flex flex-col items-end gap-0.5">
                            <span>{formatMXN(row.tip)}</span>
                            {row.prev ? (
                              <DeltaBadge
                                current={row.tip}
                                previous={row.prev.tip}
                                money
                              />
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-bold">
                          {formatMXN(row.neta)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono">
                          {formatMXN(row.ticketPromedio)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {row.deltaVsAvgPct == null ? (
                            <span className="text-outline text-[10px]">—</span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                                selected
                                  ? row.deltaVsAvgPct >= 0
                                    ? "text-emerald-200"
                                    : "text-red-200"
                                  : row.deltaVsAvgPct >= 0
                                    ? "text-emerald-700"
                                    : "text-red-700"
                              }`}
                            >
                              {row.deltaVsAvgPct >= 0 ? (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowDownRight className="w-3.5 h-3.5" />
                              )}
                              {row.deltaVsAvgPct >= 0 ? "+" : ""}
                              {row.deltaVsAvgPct}%
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex justify-end">
                            <Sparkline values={row.sparkline} active={selected} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* —— SECCIÓN 2: Histórico individual —— */}
      <section
        ref={historyRef}
        id={dashboardSectionDomId("historico-manicurista")}
        className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden scroll-mt-4"
      >
        <div className="p-5 md:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Histórico por manicurista
              </h3>
              <p className="text-xs text-outline mt-1">
                Tendencia individual · misma lógica que el histórico del salón
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <label className="text-[10px] font-bold uppercase tracking-wider text-outline">
                Manicurista
              </label>
              <select
                value={selectedStaffId || ""}
                onChange={(event) => selectStaff(event.target.value)}
                className="select select-sm bg-surface border border-primary/15 text-primary min-w-[12rem]"
              >
                {(data?.staff || []).map((item) => (
                  <option key={item.staffId} value={item.staffId}>
                    {item.staffName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {METRICS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMetric(item.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  metric === item.id
                    ? "bg-primary text-on-primary"
                    : "bg-surface text-outline border border-primary/10 hover:text-primary"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {selectedStaff && n > 0 ? (
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-outline">
                  {selectedStaff.staffName} · última semana
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-display text-2xl font-extrabold text-primary">
                    {formatValue(latest, activeMetric.money)}
                  </span>
                  {deltaPct != null ? (
                    <span
                      className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                        deltaPct >= 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {deltaPct >= 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      {deltaPct >= 0 ? "+" : ""}
                      {deltaPct}%
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="text-[10px] text-outline">
                Promedio: {formatValue(average, activeMetric.money)}
              </p>
            </div>
          ) : null}

          {isLoading && !data ? (
            <div className="h-48 flex items-center justify-center text-sm text-outline">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando histórico…
            </div>
          ) : n === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-outline">
              Sin semanas para graficar.
            </div>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="w-full h-auto select-none touch-none"
              onPointerMove={handlePointer}
              onPointerDown={handlePointer}
              onPointerLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id="staffTrendArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary, #6d4d3f)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--color-primary, #6d4d3f)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {gridValues.map((value, index) => {
                const y = yFor(value);
                return (
                  <g key={`g-${index}`}>
                    <line
                      x1={M_LEFT}
                      x2={VIEW_W - M_RIGHT}
                      y1={y}
                      y2={y}
                      stroke="currentColor"
                      className="text-primary/10"
                      strokeWidth={1}
                    />
                    <text
                      x={M_LEFT - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-outline"
                      style={{ fontSize: 10 }}
                    >
                      {formatCompact(value, activeMetric.money)}
                    </text>
                  </g>
                );
              })}

              <line
                x1={M_LEFT}
                x2={VIEW_W - M_RIGHT}
                y1={yFor(average)}
                y2={yFor(average)}
                stroke="currentColor"
                className="text-primary/40"
                strokeWidth={1.25}
                strokeDasharray="5 5"
              />

              {n > 1 ? <path d={areaPath} fill="url(#staffTrendArea)" /> : null}
              <path
                d={linePath}
                fill="none"
                stroke="currentColor"
                className="text-primary"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {hoverIndex != null ? (
                <line
                  x1={xFor(hoverIndex)}
                  x2={xFor(hoverIndex)}
                  y1={M_TOP}
                  y2={M_TOP + PLOT_H}
                  stroke="currentColor"
                  className="text-primary/25"
                  strokeWidth={1}
                />
              ) : null}

              {chartSeries.map((point, index) => {
                const isActive = hoverIndex === index;
                const isLast = index === n - 1;
                return (
                  <circle
                    key={`p-${index}`}
                    cx={xFor(index)}
                    cy={yFor(point.value)}
                    r={isActive ? 6 : isLast ? 5 : 3.5}
                    className={
                      isActive || isLast ? "fill-primary" : "fill-surface-container-lowest"
                    }
                    stroke="currentColor"
                    style={{ color: "var(--color-primary, #6d4d3f)" }}
                    strokeWidth={2}
                  />
                );
              })}

              {chartSeries.map((point, index) => {
                if (index % labelStep !== 0 && index !== n - 1) return null;
                return (
                  <text
                    key={`xl-${index}`}
                    x={xFor(index)}
                    y={VIEW_H - 10}
                    textAnchor="middle"
                    className="fill-outline"
                    style={{ fontSize: 10 }}
                  >
                    {point.label}
                  </text>
                );
              })}

              {hoverIndex != null && chartSeries[hoverIndex]
                ? (() => {
                    const hovered = chartSeries[hoverIndex];
                    const cx = xFor(hoverIndex);
                    const boxW = 140;
                    const boxH = 46;
                    const boxX = Math.min(
                      VIEW_W - M_RIGHT - boxW,
                      Math.max(M_LEFT, cx - boxW / 2)
                    );
                    const boxY = Math.max(M_TOP, yFor(hovered.value) - boxH - 12);
                    return (
                      <g>
                        <rect
                          x={boxX}
                          y={boxY}
                          width={boxW}
                          height={boxH}
                          rx={8}
                          className="fill-primary"
                        />
                        <text
                          x={boxX + 10}
                          y={boxY + 18}
                          className="fill-on-primary"
                          style={{ fontSize: 10, opacity: 0.8 }}
                        >
                          {hovered.rangeLabel}
                        </text>
                        <text
                          x={boxX + 10}
                          y={boxY + 36}
                          className="fill-on-primary"
                          style={{ fontSize: 14, fontWeight: 800 }}
                        >
                          {formatValue(hovered.value, activeMetric.money)}
                        </text>
                      </g>
                    );
                  })()
                : null}
            </svg>
          )}

          {/* KPIs secundarios */}
          {selectedDetail ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div className="rounded-xl border border-primary/10 bg-surface px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                  Ocupación
                </p>
                <p className="font-display text-xl font-extrabold text-primary mt-1">
                  {selectedDetail.occupancyPct == null
                    ? "—"
                    : `${selectedDetail.occupancyPct}%`}
                </p>
                <p className="text-[10px] text-outline mt-1">
                  {selectedDetail.productiveHours}h / {selectedDetail.availableHours}h
                  agenda
                </p>
              </div>
              <div className="rounded-xl border border-primary/10 bg-surface px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                  Cancelaciones
                </p>
                <p className="font-display text-xl font-extrabold text-primary mt-1">
                  {selectedDetail.cancelled}
                </p>
                <p className="text-[10px] text-outline mt-1">
                  {selectedDetail.citas + selectedDetail.cancelled > 0
                    ? `${Math.round(
                        (selectedDetail.cancelled /
                          (selectedDetail.citas + selectedDetail.cancelled)) *
                          100
                      )}% del total`
                    : "Sin citas"}
                </p>
              </div>
              <div className="rounded-xl border border-primary/10 bg-surface px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                  Recurrentes
                </p>
                <p className="font-display text-xl font-extrabold text-primary mt-1">
                  {selectedDetail.recurrentClients}
                </p>
                <p className="text-[10px] text-outline mt-1">Clientes que ya la habían visto</p>
              </div>
              <div className="rounded-xl border border-primary/10 bg-surface px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                  Nuevas
                </p>
                <p className="font-display text-xl font-extrabold text-primary mt-1">
                  {selectedDetail.newClients}
                </p>
                <p className="text-[10px] text-outline mt-1">Primera cita pagada con ella</p>
              </div>
            </div>
          ) : null}

          <p className="text-[10px] text-outline">
            Neta = bruta − comisión − propinas. Ocupación = horas de citas
            pagadas ÷ horas de agenda del salón en la semana. Recurrente/nueva se calcula
            por manicurista.
          </p>
        </div>
      </section>
    </div>
  );
}
