"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDownRight, ArrowUpRight, Loader2, TrendingUp } from "lucide-react";
import posApi from "@/libs/posApi";
import { formatMXN } from "../data";
import { WeeklyStats } from "../types";
import { dashboardSectionDomId } from "../dashboardNav";

type MetricId = "citas" | "bruta" | "comision" | "propinas" | "neta";

type MetricDef = {
  id: MetricId;
  label: string;
  money: boolean;
  value: (s: WeeklyStats) => number;
};

const METRICS: MetricDef[] = [
  { id: "citas", label: "Citas", money: false, value: (s) => s.completedAppointmentsCount ?? 0 },
  { id: "bruta", label: "Venta bruta", money: true, value: (s) => s.grossSales ?? 0 },
  { id: "comision", label: "Comisión", money: true, value: (s) => s.estimatedCommission ?? 0 },
  { id: "propinas", label: "Propinas", money: true, value: (s) => s.tips ?? 0 },
  { id: "neta", label: "Venta neta", money: true, value: (s) => s.salonNet ?? 0 },
];

// Espacio de coordenadas del SVG (se escala de forma responsiva con viewBox).
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
  // "12 Jul, 2026" -> "12 Jul"
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

export default function WeeklyHistoryTrendCard() {
  const [metric, setMetric] = useState<MetricId>("bruta");
  const [snapshots, setSnapshots] = useState<WeeklyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await posApi.getWeeklyHistory();
        if (!cancelled) setSnapshots(result.snapshots || []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("No se pudo cargar el histórico semanal.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeMetric = METRICS.find((m) => m.id === metric) || METRICS[1];

  const series = useMemo(
    () =>
      snapshots.map((snapshot) => ({
        label: shortWeekLabel(snapshot.weekStartDate),
        rangeLabel: snapshot.weekRangeLabel || snapshot.weekStartDate,
        value: activeMetric.value(snapshot),
      })),
    [snapshots, activeMetric]
  );

  const n = series.length;

  const maxValue = useMemo(
    () => Math.max(0, ...series.map((point) => point.value)),
    [series]
  );
  const maxY = niceMax(maxValue);

  const average = useMemo(
    () => (n > 0 ? series.reduce((sum, point) => sum + point.value, 0) / n : 0),
    [series, n]
  );

  const latest = n > 0 ? series[n - 1].value : 0;
  const previous = n > 1 ? series[n - 2].value : 0;
  const delta = latest - previous;
  const deltaPct = previous > 0 ? Math.round((delta / previous) * 100) : null;

  const xFor = (index: number) =>
    n <= 1 ? M_LEFT + PLOT_W / 2 : M_LEFT + (index / (n - 1)) * PLOT_W;
  const yFor = (value: number) => M_TOP + PLOT_H - (value / maxY) * PLOT_H;

  const linePath = series
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(point.value).toFixed(1)}`)
    .join(" ");

  const areaPath =
    n > 0
      ? `${linePath} L ${xFor(n - 1).toFixed(1)} ${(M_TOP + PLOT_H).toFixed(1)} L ${xFor(0).toFixed(1)} ${(
          M_TOP + PLOT_H
        ).toFixed(1)} Z`
      : "";

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((factor) => maxY * factor);

  // Muestra un subconjunto de etiquetas del eje X para no saturar.
  const labelStep = Math.max(1, Math.ceil(n / 8));

  const handlePointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || n === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    const ratio = (relX - M_LEFT) / PLOT_W;
    const index = Math.round(ratio * (n - 1));
    setHoverIndex(Math.min(n - 1, Math.max(0, index)));
  };

  const hovered = hoverIndex != null ? series[hoverIndex] : null;

  return (
    <section
      id={dashboardSectionDomId("historico-semanal")}
      className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden scroll-mt-4"
    >
      <div className="p-5 md:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Histórico semanal
            </h3>
            <p className="text-xs text-outline mt-1">
              Tendencia semana a semana · {n} {n === 1 ? "semana" : "semanas"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-outline" /> : null}
            {n > 0 ? (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-outline">Última semana</p>
                <div className="flex items-center justify-end gap-2">
                  <span className="font-display text-xl font-extrabold text-primary">
                    {formatValue(latest, activeMetric.money)}
                  </span>
                  {deltaPct != null ? (
                    <span
                      className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                        delta >= 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {delta >= 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      {delta >= 0 ? "+" : "−"}
                      {Math.abs(deltaPct)}%
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Selector de métrica */}
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

        {/* Gráfica */}
        {error ? (
          <div className="h-48 flex items-center justify-center text-sm text-red-700">{error}</div>
        ) : isLoading && n === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-outline">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando histórico…
          </div>
        ) : n === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-outline">
            Aún no hay semanas registradas para graficar.
          </div>
        ) : (
          <div className="w-full">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="w-full h-auto select-none touch-none"
              onPointerMove={handlePointer}
              onPointerDown={handlePointer}
              onPointerLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary, #6d4d3f)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--color-primary, #6d4d3f)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid + etiquetas eje Y */}
              {gridValues.map((value, index) => {
                const y = yFor(value);
                return (
                  <g key={`grid-${index}`}>
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

              {/* Línea de promedio */}
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
              <text
                x={VIEW_W - M_RIGHT}
                y={yFor(average) - 5}
                textAnchor="end"
                className="fill-primary/60"
                style={{ fontSize: 9, fontWeight: 700 }}
              >
                Prom {formatCompact(average, activeMetric.money)}
              </text>

              {/* Área + línea */}
              {n > 1 ? <path d={areaPath} fill="url(#trendArea)" /> : null}
              <path
                d={linePath}
                fill="none"
                stroke="currentColor"
                className="text-primary"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* Guía vertical al hacer hover */}
              {hovered ? (
                <line
                  x1={xFor(hoverIndex as number)}
                  x2={xFor(hoverIndex as number)}
                  y1={M_TOP}
                  y2={M_TOP + PLOT_H}
                  stroke="currentColor"
                  className="text-primary/25"
                  strokeWidth={1}
                />
              ) : null}

              {/* Puntos */}
              {series.map((point, index) => {
                const isActive = hoverIndex === index;
                const isLast = index === n - 1;
                return (
                  <circle
                    key={`pt-${index}`}
                    cx={xFor(index)}
                    cy={yFor(point.value)}
                    r={isActive ? 6 : isLast ? 5 : 3.5}
                    className={isActive || isLast ? "fill-primary" : "fill-surface-container-lowest"}
                    stroke="currentColor"
                    style={{ color: "var(--color-primary, #6d4d3f)" }}
                    strokeWidth={2}
                  />
                );
              })}

              {/* Etiquetas eje X */}
              {series.map((point, index) => {
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

              {/* Tooltip */}
              {hovered
                ? (() => {
                    const cx = xFor(hoverIndex as number);
                    const boxW = 132;
                    const boxH = 46;
                    const rawX = cx - boxW / 2;
                    const boxX = Math.min(VIEW_W - M_RIGHT - boxW, Math.max(M_LEFT, rawX));
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
          </div>
        )}

        <p className="text-[10px] text-outline">
          Cada punto es una semana. Línea punteada = promedio del periodo. Toca o pasa el cursor
          sobre un punto para ver el detalle. Venta neta = bruta − comisión − propinas.
        </p>
      </div>
    </section>
  );
}
