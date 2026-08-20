import { WeeklyBreakdownDay, WeeklyStats } from "./types";
import { getMexicoDateYMD, spanishShortDateToYmd } from "./scheduleUtils";

export type ProjectionConfidence = "low" | "medium" | "high";

export type WeekAppointmentProjection = {
  /** Citas terminadas acumuladas usadas en el cálculo (hasta ayer, o hoy si es sábado). */
  cumulativeSoFar: number;
  /** Índice del último día incluido (0=sáb … 6=vie). */
  throughDayIndex: number;
  /** % histórico típico acumulado a esa altura (0–100). */
  historicalSharePct: number;
  /** Cierre estimado de la semana. */
  projectedTotal: number;
  /** Rango probable (p25–p75 de proyecciones históricas). */
  rangeLow: number;
  rangeHigh: number;
  /** Semanas históricas usadas. */
  historyWeeksUsed: number;
  confidence: ProjectionConfidence;
  /** Día de referencia legible (ej. "Lun"). */
  throughDayLabel: string;
  note: string;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function dayCounts(days: WeeklyBreakdownDay[] | undefined): number[] {
  const counts = (days || []).slice(0, 7).map((day) => Number(day?.count) || 0);
  while (counts.length < 7) counts.push(0);
  return counts;
}

function cumulativeAt(counts: number[], throughIndex: number): number {
  if (throughIndex < 0) return 0;
  return counts.slice(0, throughIndex + 1).reduce((sum, n) => sum + n, 0);
}

function findTodayIndex(days: WeeklyBreakdownDay[], todayYmd: string): number {
  const idx = days.findIndex((day) => spanishShortDateToYmd(day.dateLabel) === todayYmd);
  return idx >= 0 ? idx : -1;
}

/**
 * Proyección de citas al cierre de semana (sáb–vie):
 * perfil histórico por día + % acumulado + rango p25–p75.
 */
export function projectWeekCompletedAppointments(params: {
  current: WeeklyStats | null | undefined;
  history: WeeklyStats[];
  todayYmd?: string;
}): WeekAppointmentProjection | null {
  const current = params.current;
  if (!current?.completedByDay?.length) return null;

  const todayYmd = params.todayYmd || getMexicoDateYMD(new Date());
  const currentDays = current.completedByDay;
  const todayIndex = findTodayIndex(currentDays, todayYmd);
  if (todayIndex < 0) return null;

  // Hasta ayer (más estable). El sábado usa solo el parcial de hoy.
  const throughDayIndex = todayIndex === 0 ? 0 : todayIndex - 1;
  const currentCounts = dayCounts(currentDays);
  const cumulativeSoFar = cumulativeAt(currentCounts, throughDayIndex);
  const throughDayLabel =
    currentDays[throughDayIndex]?.dayLabel || `Día ${throughDayIndex + 1}`;

  const history = (params.history || []).filter(
    (week) =>
      week.weekStartDate !== current.weekStartDate &&
      (week.completedAppointmentsCount ?? 0) > 0 &&
      (week.completedByDay?.length || 0) >= 5
  );

  if (history.length === 0) {
    return {
      cumulativeSoFar,
      throughDayIndex,
      historicalSharePct: 0,
      projectedTotal: cumulativeSoFar,
      rangeLow: cumulativeSoFar,
      rangeHigh: cumulativeSoFar,
      historyWeeksUsed: 0,
      confidence: "low",
      throughDayLabel,
      note: "Faltan semanas históricas para proyectar el cierre.",
    };
  }

  // Perfil medio por día
  const avgByDay = Array.from({ length: 7 }, (_, dayIdx) => {
    const values = history.map((week) => dayCounts(week.completedByDay)[dayIdx]);
    return values.reduce((sum, n) => sum + n, 0) / values.length;
  });
  const avgWeekTotal = avgByDay.reduce((sum, n) => sum + n, 0);

  if (avgWeekTotal <= 0) {
    return null;
  }

  const avgCumulative = cumulativeAt(avgByDay, throughDayIndex);
  const share = avgCumulative / avgWeekTotal;
  const historicalSharePct = Math.round(share * 100);

  // Proyecciones por semana histórica en el mismo punto
  const weekProjections: number[] = [];
  for (const week of history) {
    const counts = dayCounts(week.completedByDay);
    const total = week.completedAppointmentsCount || counts.reduce((s, n) => s + n, 0);
    if (total <= 0) continue;
    const cum = cumulativeAt(counts, throughDayIndex);
    const frac = cum / total;
    if (frac < 0.12) continue; // evita dividir por fracciones absurdas al inicio
    weekProjections.push(cumulativeSoFar / frac);
  }

  const sorted = [...weekProjections].sort((a, b) => a - b);
  const projectedFromShare = share > 0.08 ? cumulativeSoFar / share : cumulativeSoFar;
  const projectedTotal = Math.max(
    cumulativeSoFar,
    Math.round(
      sorted.length > 0 ? percentile(sorted, 0.5) : projectedFromShare
    )
  );
  const rangeLow = Math.max(
    cumulativeSoFar,
    Math.round(sorted.length > 0 ? percentile(sorted, 0.25) : projectedTotal * 0.9)
  );
  const rangeHigh = Math.max(
    rangeLow,
    Math.round(sorted.length > 0 ? percentile(sorted, 0.75) : projectedTotal * 1.1)
  );

  let confidence: ProjectionConfidence = "low";
  if (history.length >= 6 && throughDayIndex >= 4) confidence = "high";
  else if (history.length >= 3 && throughDayIndex >= 2) confidence = "medium";

  const note =
    todayIndex === 0
      ? "Sábado en curso: proyección temprana (solo con el parcial de hoy)."
      : `Con ~${historicalSharePct}% típico hasta ${throughDayLabel}, el cierre estimado es ${projectedTotal}.`;

  return {
    cumulativeSoFar,
    throughDayIndex,
    historicalSharePct,
    projectedTotal,
    rangeLow,
    rangeHigh,
    historyWeeksUsed: history.length,
    confidence,
    throughDayLabel,
    note,
  };
}

export function projectionConfidenceLabel(confidence: ProjectionConfidence): string {
  if (confidence === "high") return "Confianza alta";
  if (confidence === "medium") return "Confianza media";
  return "Confianza baja";
}
