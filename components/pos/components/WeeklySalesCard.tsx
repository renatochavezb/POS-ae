"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, X } from "lucide-react";
import posApi from "@/libs/posApi";
import { formatMXN } from "../data";
import { addDays, getStudioWeekStart } from "../scheduleUtils";
import type { WeeklyBreakdownDay } from "../types";
import { useWeeklySnapshot } from "../useWeeklySnapshot";

type DayPaymentBreakdown = {
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  gift_card: number;
  tips: number;
  services: number;
};

type WeekPaymentBreakdown = {
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  gift_card: number;
  tips: number;
  services: number;
  giftCardSales: number;
};

const EMPTY_WEEK_BREAKDOWN: WeekPaymentBreakdown = {
  efectivo: 0,
  tarjeta: 0,
  transferencia: 0,
  gift_card: 0,
  tips: 0,
  services: 0,
  giftCardSales: 0,
};

function sumMethodsFromDays(days: WeeklyBreakdownDay[]): Pick<
  WeekPaymentBreakdown,
  "efectivo" | "tarjeta" | "transferencia" | "gift_card"
> {
  return days.reduce(
    (acc, day) => ({
      efectivo: acc.efectivo + (Number(day.efectivo) || 0),
      tarjeta: acc.tarjeta + (Number(day.tarjeta) || 0),
      transferencia: acc.transferencia + (Number(day.transferencia) || 0),
      gift_card: acc.gift_card + (Number(day.gift_card) || 0),
    }),
    {
      efectivo: 0,
      tarjeta: 0,
      transferencia: 0,
      gift_card: 0,
    }
  );
}

function methodsTotal(
  methods: Pick<WeekPaymentBreakdown, "efectivo" | "tarjeta" | "transferencia" | "gift_card">
): number {
  return (
    methods.efectivo + methods.tarjeta + methods.transferencia + methods.gift_card
  );
}

export default function WeeklySalesCard() {
  const [weekStart, setWeekStart] = useState<Date>(() => getStudioWeekStart(new Date()));
  const [showDetails, setShowDetails] = useState(false);
  const [selectedDay, setSelectedDay] = useState<WeeklyBreakdownDay | null>(null);
  const [dayBreakdown, setDayBreakdown] = useState<DayPaymentBreakdown | null>(null);
  const [dayBreakdownLoading, setDayBreakdownLoading] = useState(false);
  const [dayBreakdownError, setDayBreakdownError] = useState<string | null>(null);
  const [weekBreakdown, setWeekBreakdown] = useState<WeekPaymentBreakdown | null>(null);
  const [weekMethodsLoading, setWeekMethodsLoading] = useState(false);
  const [weekBreakdownError, setWeekBreakdownError] = useState<string | null>(null);
  const [showWeekSalesModal, setShowWeekSalesModal] = useState(false);
  const { snapshot, isLoading, weekRangeLabel, viewingCurrentWeek } = useWeeklySnapshot(weekStart);

  const weekTotalSales = snapshot?.grossSales ?? 0;
  const weekTotalCommission = snapshot?.estimatedCommission ?? 0;
  const weekTips = snapshot?.tips ?? 0;
  const weekSalonNet = snapshot?.salonNet ?? 0;
  const weekDeltaPercent = snapshot?.grossSalesWeekDeltaPercent ?? null;
  const byDay = snapshot?.salesByDay ?? [];
  const byStaff = snapshot?.salesByStaff ?? [];

  const snapshotWeekMethods = useMemo(() => sumMethodsFromDays(byDay), [byDay]);

  useEffect(() => {
    setWeekBreakdown(null);
    setWeekBreakdownError(null);
    setShowWeekSalesModal(false);
  }, [weekStart]);

  // Al abrir el popup: cobros reales de toda la semana (servicios, propinas, gift cards, métodos).
  useEffect(() => {
    if (!showWeekSalesModal) return;
    if (byDay.length === 0) {
      setWeekBreakdown({
        ...EMPTY_WEEK_BREAKDOWN,
        ...snapshotWeekMethods,
        tips: weekTips,
        services: weekTotalSales,
      });
      return;
    }

    let cancelled = false;
    setWeekMethodsLoading(true);
    setWeekBreakdownError(null);

    Promise.all(byDay.map((day) => posApi.getPayments({ date: day.dateLabel })))
      .then((results) => {
        if (cancelled) return;
        const totals = results.reduce(
          (acc, result) => ({
            efectivo: acc.efectivo + (result.summary?.efectivo ?? 0),
            tarjeta: acc.tarjeta + (result.summary?.tarjeta ?? 0),
            transferencia: acc.transferencia + (result.summary?.transferencia ?? 0),
            gift_card: acc.gift_card + (result.summary?.gift_card ?? 0),
            tips: acc.tips + (result.summary?.tips ?? 0),
            services: acc.services + (result.summary?.services ?? 0),
            giftCardSales: acc.giftCardSales + (result.summary?.giftCardSales ?? 0),
          }),
          { ...EMPTY_WEEK_BREAKDOWN }
        );

        // Si no hubo cobros en API, caer al snapshot KPI.
        if (methodsTotal(totals) <= 0 && weekTotalSales > 0) {
          setWeekBreakdown({
            ...EMPTY_WEEK_BREAKDOWN,
            ...snapshotWeekMethods,
            tips: weekTips,
            services: weekTotalSales,
          });
        } else {
          setWeekBreakdown(totals);
        }
      })
      .catch((error) => {
        console.error(error);
        if (cancelled) return;
        if (methodsTotal(snapshotWeekMethods) > 0) {
          setWeekBreakdown({
            ...EMPTY_WEEK_BREAKDOWN,
            ...snapshotWeekMethods,
            tips: weekTips,
            services: weekTotalSales,
          });
        } else {
          setWeekBreakdownError("No se pudo cargar el desglose de la semana.");
          setWeekBreakdown(null);
        }
      })
      .finally(() => {
        if (!cancelled) setWeekMethodsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showWeekSalesModal, byDay, snapshotWeekMethods, weekTips, weekTotalSales]);

  const weekMethodsSum = weekBreakdown ? methodsTotal(weekBreakdown) : 0;
  const weekCompositionTotal = weekBreakdown
    ? weekBreakdown.services + weekBreakdown.tips + weekBreakdown.giftCardSales
    : 0;

  const weekMethodRows = weekBreakdown
    ? (
        [
          { key: "efectivo", label: "Efectivo", value: weekBreakdown.efectivo },
          { key: "tarjeta", label: "Tarjeta", value: weekBreakdown.tarjeta },
          {
            key: "transferencia",
            label: "Transferencia",
            value: weekBreakdown.transferencia,
          },
          ...(weekBreakdown.gift_card > 0
            ? [
                {
                  key: "gift_card",
                  label: "Pagado con gift card",
                  value: weekBreakdown.gift_card,
                },
              ]
            : []),
        ] as const
      )
    : [];

  useEffect(() => {
    if (!selectedDay) {
      setDayBreakdown(null);
      setDayBreakdownError(null);
      setDayBreakdownLoading(false);
      return;
    }

    let cancelled = false;
    setDayBreakdownLoading(true);
    setDayBreakdownError(null);
    setDayBreakdown(null);

    // Siempre desde cobros reales del día (no confiar en el snapshot KPI).
    posApi
      .getPayments({ date: selectedDay.dateLabel })
      .then(async (result) => {
        if (cancelled) return;
        let breakdown: DayPaymentBreakdown = {
          efectivo: result.summary?.efectivo ?? 0,
          tarjeta: result.summary?.tarjeta ?? 0,
          transferencia: result.summary?.transferencia ?? 0,
          gift_card: result.summary?.gift_card ?? 0,
          tips: result.summary?.tips ?? 0,
          services: result.summary?.services ?? 0,
        };

        const dayMethodsTotal =
          breakdown.efectivo +
          breakdown.tarjeta +
          breakdown.transferencia +
          breakdown.gift_card;

        // Fallback: cortes cerrados del día (por si faltan montos en pagos viejos).
        if (dayMethodsTotal <= 0 && (selectedDay.sales || 0) > 0) {
          try {
            const history = await posApi.getCashSessionHistory({
              scope: "today",
              date: selectedDay.dateLabel,
              limit: 20,
            });
            const sessions = history.sessions || [];
            if (sessions.length > 0) {
              breakdown = {
                ...sessions.reduce(
                  (acc, session) => ({
                    efectivo: acc.efectivo + (session.totalEfectivo ?? 0),
                    tarjeta: acc.tarjeta + (session.totalTarjeta ?? 0),
                    transferencia: acc.transferencia + (session.totalTransferencia ?? 0),
                    gift_card: acc.gift_card + (session.totalGiftCard ?? 0),
                  }),
                  { efectivo: 0, tarjeta: 0, transferencia: 0, gift_card: 0 }
                ),
                tips: breakdown.tips,
                services: breakdown.services,
              };
            }
          } catch {
            // Mantener el resumen de pagos aunque el historial falle.
          }
        }

        if (!cancelled) setDayBreakdown(breakdown);
      })
      .catch(() => {
        if (cancelled) return;
        setDayBreakdown(null);
        setDayBreakdownError("No se pudo cargar el desglose de pagos.");
      })
      .finally(() => {
        if (!cancelled) setDayBreakdownLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDay]);

  const paymentTotal = dayBreakdown
    ? dayBreakdown.efectivo +
      dayBreakdown.tarjeta +
      dayBreakdown.transferencia +
      dayBreakdown.gift_card
    : 0;

  return (
    <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 flex-1">
        <div className="space-y-3 min-w-0 flex-1">
          <span className="text-[10px] text-outline font-bold tracking-widest uppercase block">
            Ventas Totales
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

          <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
            <div>
              <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">
                Ventas brutas
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-extrabold text-primary leading-none">
                  {isLoading ? "—" : formatMXN(weekTotalSales)}
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
            </div>

            <div>
              <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">
                Comisión estimada
              </p>
              <p className="font-display text-2xl font-extrabold text-secondary leading-none">
                {isLoading ? "—" : formatMXN(weekTotalCommission)}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-1">
                Neto para el salón
              </p>
              <p className="font-display text-4xl font-extrabold text-blue-600 leading-none">
                {isLoading ? "—" : formatMXN(weekSalonNet)}
              </p>
              {!isLoading && weekTips > 0 && (
                <p className="text-[9px] text-outline mt-1">
                  − propinas {formatMXN(weekTips)}
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-on-surface-variant">
            KPI semanal en Mongo · ventas − comisión − propinas.
          </p>

          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="text-[10px] font-sans font-bold uppercase tracking-wider text-secondary hover:text-primary transition-colors"
          >
            {showDetails ? "Ocultar detalle" : "Ver por día y manicurista"}
          </button>
        </div>

        <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
          <TrendingUp className="w-6 h-6" />
        </div>
      </div>

      {showDetails && (
        <div className="mt-5 pt-5 border-t border-primary/5 space-y-5 w-full">
          <div className="w-full">
            <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-2">
              Por día
            </p>
            <p className="text-[10px] text-outline/80 mb-2">
              Toca un día para ver el desglose por método de pago.
            </p>
            <div className="grid grid-cols-7 gap-2 w-full">
              {byDay.map((day) => (
                <button
                  key={day.dateLabel}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className="rounded-lg border border-primary/10 bg-surface-container-low/40 px-2 py-3 text-center min-w-0 hover:border-secondary/40 hover:bg-secondary/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
                >
                  <p className="text-[9px] text-outline font-bold uppercase">{day.dayLabel}</p>
                  <p className="text-sm font-mono font-bold text-primary mt-1.5 leading-tight">
                    {formatMXN(day.sales)}
                  </p>
                  <p className="text-[10px] text-secondary font-bold mt-1 leading-tight">
                    {formatMXN(day.commission)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="w-full">
            <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-2">
              Por manicurista
            </p>
            {byStaff.length === 0 ? (
              <p className="text-xs text-outline">Sin ventas registradas en esta semana.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 w-full">
                {byStaff.map((member) => (
                  <div
                    key={member.staffId}
                    className="flex items-center justify-between gap-3 text-xs px-3 py-2.5 rounded-lg bg-surface-container-low/30"
                  >
                    <div className="min-w-0">
                      <p className="font-sans font-bold text-primary truncate">{member.staffName}</p>
                      <p className="text-[10px] text-outline">
                        Comisión {member.commissionPercent}%
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-primary">{formatMXN(member.sales)}</p>
                      <p className="text-[10px] font-mono font-bold text-secondary">
                        {formatMXN(member.commission)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-primary/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs w-full">
            <div className="flex items-center justify-between sm:justify-start sm:gap-4 rounded-lg bg-surface-container-low/30 px-3 py-2">
              <button
                type="button"
                onDoubleClick={() => setShowWeekSalesModal(true)}
                title="Doble clic para ver efectivo, tarjeta y transferencia"
                className="text-outline font-bold uppercase tracking-wider text-left hover:text-primary transition-colors select-none"
              >
                Total ventas
              </button>
              <span className="font-display font-extrabold text-primary">
                {formatMXN(weekTotalSales)}
              </span>
            </div>
            <div className="flex items-center justify-between sm:justify-start sm:gap-4 rounded-lg bg-surface-container-low/30 px-3 py-2">
              <span className="text-outline font-bold uppercase tracking-wider">
                Total comisión
              </span>
              <span className="font-display font-extrabold text-secondary">
                {formatMXN(weekTotalCommission)}
              </span>
            </div>
            <div className="flex items-center justify-between sm:justify-start sm:gap-4 rounded-lg bg-surface-container-low/30 px-3 py-2">
              <span className="text-outline font-bold uppercase tracking-wider">Propinas</span>
              <span className="font-display font-extrabold text-outline">
                {formatMXN(weekTips)}
              </span>
            </div>
            <div className="flex items-center justify-between sm:justify-start sm:gap-4 rounded-lg bg-surface-container-low/30 px-3 py-2">
              <span className="text-outline font-bold uppercase tracking-wider">Neto salón</span>
              <span className="font-display font-extrabold text-primary">
                {formatMXN(weekSalonNet)}
              </span>
            </div>
          </div>
        </div>
      )}

      {showWeekSalesModal && (
        <div
          className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm"
          onClick={() => setShowWeekSalesModal(false)}
          role="presentation"
        >
          <div
            className="bg-surface-container-lowest w-full sm:max-w-md max-h-[min(92dvh,40rem)] overflow-y-auto overscroll-contain rounded-t-2xl sm:rounded-2xl border border-primary/10 luxury-shadow p-5 sm:p-6"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="week-payment-breakdown-title"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] text-outline font-bold uppercase tracking-widest">
                  Desglose de cobros
                </p>
                <h3
                  id="week-payment-breakdown-title"
                  className="font-display text-xl font-extrabold text-primary mt-1"
                >
                  Total ventas · semana
                </h3>
                <p className="text-xs text-outline mt-1">{weekRangeLabel}</p>
                <p className="text-xs text-outline mt-0.5">
                  Total cobrado = servicios + propinas + venta de gift cards
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWeekSalesModal(false)}
                className="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container-low transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {weekMethodsLoading ? (
              <div className="flex items-center justify-center py-10">
                <span className="loading loading-spinner loading-md text-secondary" />
              </div>
            ) : weekBreakdownError ? (
              <p className="text-sm text-red-700 py-6 text-center">{weekBreakdownError}</p>
            ) : weekBreakdown ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-primary/10 bg-surface-container-low/40 px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-outline font-sans font-bold">Ventas (servicios)</span>
                    <span className="font-mono font-bold text-primary">
                      {formatMXN(weekBreakdown.services)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-outline font-sans font-bold">Propinas</span>
                    <span className="font-mono font-bold text-primary">
                      {formatMXN(weekBreakdown.tips)}
                    </span>
                  </div>
                  {weekBreakdown.giftCardSales > 0 ? (
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-outline font-sans font-bold">
                        Venta de gift cards
                      </span>
                      <span className="font-mono font-bold text-primary">
                        {formatMXN(weekBreakdown.giftCardSales)}
                      </span>
                    </div>
                  ) : null}
                  <div className="pt-2 border-t border-primary/10">
                    <p className="text-xs font-mono font-bold text-primary text-center leading-relaxed">
                      {formatMXN(weekBreakdown.services)}
                      {weekBreakdown.tips > 0 ? ` + ${formatMXN(weekBreakdown.tips)}` : ""}
                      {weekBreakdown.giftCardSales > 0
                        ? ` + ${formatMXN(weekBreakdown.giftCardSales)}`
                        : ""}{" "}
                      = {formatMXN(weekCompositionTotal)}
                    </p>
                    <p className="text-[10px] text-outline text-center mt-1">
                      De dónde sale el total cobrado
                    </p>
                  </div>
                  {Math.abs(weekBreakdown.services - weekTotalSales) > 0.5 ? (
                    <p className="text-[10px] text-outline text-center">
                      KPI «Total ventas» del card: {formatMXN(weekTotalSales)} (citas terminadas)
                    </p>
                  ) : null}
                </div>

                <p className="text-[10px] text-outline font-bold uppercase tracking-wider pt-1">
                  Por método de pago
                </p>
                <p className="text-[10px] text-outline -mt-2">
                  Cómo entró ese dinero (suma = total cobrado)
                </p>

                {weekMethodsSum > 0 ? (
                  weekMethodRows.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl bg-surface-container-low/50 border border-primary/5"
                    >
                      <span className="text-sm font-sans font-bold text-primary">{row.label}</span>
                      <span className="font-mono font-bold text-primary">
                        {formatMXN(row.value)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-outline py-4 text-center">
                    Sin desglose por método en esta semana.
                  </p>
                )}

                {weekMethodsSum > 0 ? (
                  <div className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl border border-secondary/20 bg-secondary/5 mt-1">
                    <div>
                      <span className="text-xs font-sans font-bold uppercase tracking-wider text-secondary block">
                        Total cobrado
                      </span>
                      <span className="text-[10px] text-outline font-mono">
                        {formatMXN(weekBreakdown.services)}
                        {weekBreakdown.tips > 0 ? ` + ${formatMXN(weekBreakdown.tips)}` : ""}
                        {weekBreakdown.giftCardSales > 0
                          ? ` + ${formatMXN(weekBreakdown.giftCardSales)}`
                          : ""}
                      </span>
                    </div>
                    <span className="font-display font-extrabold text-secondary">
                      {formatMXN(weekMethodsSum)}
                    </span>
                  </div>
                ) : null}

                {weekMethodsSum > 0 &&
                Math.abs(weekMethodsSum - weekCompositionTotal) > 1 ? (
                  <p className="text-[10px] text-amber-800 text-center">
                    Diferencia métodos vs composición:{" "}
                    {formatMXN(weekMethodsSum - weekCompositionTotal)}. Revisa cobros
                    mixtos o datos viejos.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {selectedDay && (
        <div
          className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm"
          onClick={() => setSelectedDay(null)}
          role="presentation"
        >
          <div
            className="bg-surface-container-lowest w-full sm:max-w-md max-h-[min(92dvh,40rem)] overflow-y-auto overscroll-contain rounded-t-2xl sm:rounded-2xl border border-primary/10 luxury-shadow p-5 sm:p-6"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-payment-breakdown-title"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] text-outline font-bold uppercase tracking-widest">
                  Desglose de cobros
                </p>
                <h3
                  id="day-payment-breakdown-title"
                  className="font-display text-xl font-extrabold text-primary mt-1"
                >
                  {selectedDay.dayLabel} · {selectedDay.dateLabel}
                </h3>
                <p className="text-xs text-outline mt-1">
                  Cantidad real = ventas + propinas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container-low transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {dayBreakdownLoading ? (
              <div className="flex items-center justify-center py-10">
                <span className="loading loading-spinner loading-md text-secondary" />
              </div>
            ) : dayBreakdownError ? (
              <p className="text-sm text-red-700 py-6 text-center">{dayBreakdownError}</p>
            ) : dayBreakdown ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-primary/10 bg-surface-container-low/40 px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-outline font-sans font-bold">Ventas (servicios)</span>
                    <span className="font-mono font-bold text-primary">
                      {formatMXN(selectedDay.sales)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-outline font-sans font-bold">Propinas</span>
                    <span className="font-mono font-bold text-primary">
                      {formatMXN(dayBreakdown.tips)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-primary/10">
                    <p className="text-xs font-mono font-bold text-primary text-center leading-relaxed">
                      {formatMXN(selectedDay.sales)} + {formatMXN(dayBreakdown.tips)} ={" "}
                      {formatMXN(selectedDay.sales + dayBreakdown.tips)}
                    </p>
                    <p className="text-[10px] text-outline text-center mt-1">
                      Cantidad real cobrada del día
                    </p>
                  </div>
                </div>

                <p className="text-[10px] text-outline font-bold uppercase tracking-wider pt-1">
                  Por método de pago
                </p>

                {(
                  [
                    { key: "efectivo", label: "Efectivo", value: dayBreakdown.efectivo },
                    { key: "tarjeta", label: "Tarjeta", value: dayBreakdown.tarjeta },
                    {
                      key: "transferencia",
                      label: "Transferencia",
                      value: dayBreakdown.transferencia,
                    },
                    ...(dayBreakdown.gift_card > 0
                      ? [
                          {
                            key: "gift_card",
                            label: "Tarjeta de regalo",
                            value: dayBreakdown.gift_card,
                          },
                        ]
                      : []),
                  ] as const
                ).map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl bg-surface-container-low/50 border border-primary/5"
                  >
                    <span className="text-sm font-sans font-bold text-primary">{row.label}</span>
                    <span className="font-mono font-bold text-primary">{formatMXN(row.value)}</span>
                  </div>
                ))}

                <div className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl border border-secondary/20 bg-secondary/5 mt-1">
                  <div>
                    <span className="text-xs font-sans font-bold uppercase tracking-wider text-secondary block">
                      Total cobrado
                    </span>
                    <span className="text-[10px] text-outline font-mono">
                      {formatMXN(selectedDay.sales)} + {formatMXN(dayBreakdown.tips)}
                    </span>
                  </div>
                  <span className="font-display font-extrabold text-secondary">
                    {formatMXN(paymentTotal)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
