"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { formatMXN } from "../data";
import {
  addDays,
  buildWeekDayEntries,
  formatWeekRangeLabel,
  getStudioWeekStart,
  isCurrentWeek,
} from "../scheduleUtils";
import posApi from "@/libs/posApi";
import {
  collectDiscountRows,
  summarizeDiscountsByPerson,
} from "@/libs/posPaymentDiscounts";
import { collectWarrantyRows } from "@/libs/posWarranty";

type AccountantDiscountsPanelProps = {
  title?: string;
  subtitle?: string;
};

export default function AccountantDiscountsPanel({
  title = "Descuentos y garantías",
  subtitle = "Descuentos de comisión (incl. recepción) y garantías entre manicuristas para control de calidad.",
}: AccountantDiscountsPanelProps) {
  const [weekStart, setWeekStart] = useState(() => getStudioWeekStart(new Date()));
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const weekDays = useMemo(() => buildWeekDayEntries(weekStart), [weekStart]);
  const weekRangeLabel = formatWeekRangeLabel(weekStart);
  const viewingCurrentWeek = isCurrentWeek(weekStart);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await Promise.all(
          weekDays.map((day) => posApi.getPayments({ date: day.dateLabel }))
        );
        if (!cancelled) {
          setPayments(results.flatMap((result) => result.payments || []));
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setPayments([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudieron cargar los descuentos"
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [weekDays, refreshKey]);

  const rows = useMemo(() => collectDiscountRows(payments), [payments]);
  const byPerson = useMemo(() => summarizeDiscountsByPerson(payments), [payments]);
  const warrantyRows = useMemo(() => collectWarrantyRows(payments), [payments]);
  const receptionistTotals = byPerson.filter((row) => row.role === "receptionist");
  const staffTotals = byPerson.filter((row) => row.role === "staff");
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  const receptionistAmount = receptionistTotals.reduce((sum, row) => sum + row.amount, 0);
  const staffAmount = staffTotals.reduce((sum, row) => sum + row.amount, 0);
  const warrantyTransferTotal = warrantyRows.reduce(
    (sum, row) => sum + (row.sameStaff ? 0 : row.transferAmount),
    0
  );

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-amber-200/80 luxury-shadow overflow-hidden">
      <div className="p-5 md:p-6 border-b border-amber-100 bg-amber-50/50 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[10px] text-amber-900/70 font-bold uppercase tracking-widest">
              Contabilidad
            </span>
            <h3 className="font-display text-xl font-bold text-primary mt-1 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
              {title}
            </h3>
            <p className="text-xs text-on-surface-variant mt-1 max-w-2xl">{subtitle}</p>
            <p className="text-[11px] text-outline mt-2">{weekRangeLabel}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setWeekStart((prev) => addDays(prev, -7))}
              className="p-2 rounded-lg border border-primary/10 text-primary hover:bg-surface"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {!viewingCurrentWeek && (
              <button
                type="button"
                onClick={() => setWeekStart(getStudioWeekStart(new Date()))}
                className="px-3 py-2 rounded-lg border border-primary/10 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-surface"
              >
                Esta semana
              </button>
            )}
            <button
              type="button"
              onClick={() => setWeekStart((prev) => addDays(prev, 7))}
              className="p-2 rounded-lg border border-primary/10 text-primary hover:bg-surface"
              aria-label="Semana siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary/10 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-surface disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-white/80 border border-amber-200 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Descuentos</p>
            <p className="font-display text-2xl font-black text-primary mt-1">
              {isLoading ? "—" : formatMXN(totalAmount)}
            </p>
          </div>
          <div className="rounded-xl bg-white/80 border border-amber-200 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
              Manicuristas
            </p>
            <p className="font-display text-2xl font-black text-secondary mt-1">
              {isLoading ? "—" : formatMXN(staffAmount)}
            </p>
            <p className="text-[10px] text-outline mt-0.5">Ya se resta al liquidar comisión</p>
          </div>
          <div className="rounded-xl bg-amber-100/80 border border-amber-300 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-950">
              Recepción (nómina)
            </p>
            <p className="font-display text-2xl font-black text-amber-950 mt-1">
              {isLoading ? "—" : formatMXN(receptionistAmount)}
            </p>
            <p className="text-[10px] text-amber-950/70 mt-0.5">
              Rebajar manualmente de su nómina
            </p>
          </div>
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-900">
              Garantías
            </p>
            <p className="font-display text-2xl font-black text-rose-900 mt-1">
              {isLoading ? "—" : warrantyRows.length}
            </p>
            <p className="text-[10px] text-rose-900/70 mt-0.5">
              − original / + quien realiza · {formatMXN(warrantyTransferTotal)}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 md:p-6 space-y-5">
        {error ? <p className="text-xs text-red-700 font-medium">{error}</p> : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-primary/10 p-4 space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">
              Por recepcionista
            </h4>
            {isLoading ? (
              <p className="text-xs text-outline">Cargando…</p>
            ) : receptionistTotals.length === 0 ? (
              <p className="text-xs text-outline">Sin descuentos a recepción esta semana.</p>
            ) : (
              <ul className="space-y-2">
                {receptionistTotals.map((person) => (
                  <li
                    key={`rec-${person.id}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-primary truncate">{person.name}</p>
                      <p className="text-[10px] text-outline">
                        {person.count} cargo{person.count === 1 ? "" : "s"} · recepción
                      </p>
                    </div>
                    <span className="font-display font-black text-amber-900 shrink-0">
                      −{formatMXN(person.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-primary/10 p-4 space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">
              Por manicurista
            </h4>
            {isLoading ? (
              <p className="text-xs text-outline">Cargando…</p>
            ) : staffTotals.length === 0 ? (
              <p className="text-xs text-outline">Sin descuentos a manicuristas esta semana.</p>
            ) : (
              <ul className="space-y-2">
                {staffTotals.map((person) => (
                  <li
                    key={`staff-${person.id}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-primary truncate">{person.name}</p>
                      <p className="text-[10px] text-outline">
                        {person.count} cargo{person.count === 1 ? "" : "s"} · se resta al liquidar
                      </p>
                    </div>
                    <span className="font-display font-black text-secondary shrink-0">
                      −{formatMXN(person.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-primary/10">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-surface-container-low/60 text-[10px] text-outline font-bold uppercase tracking-widest border-b border-primary/5">
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Cliente / servicio</th>
                <th className="py-3 px-4">Responsable</th>
                <th className="py-3 px-4">Motivo</th>
                <th className="py-3 px-4 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-6 px-4 text-center text-xs text-outline">
                    Cargando descuentos…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 px-4 text-center text-xs text-outline">
                    No hay descuentos registrados en {weekRangeLabel}.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={`${row.paymentId}-${row.id}-${index}`} className="text-xs">
                    <td className="py-3 px-4 font-mono text-[10px] text-outline font-bold whitespace-nowrap">
                      {row.appointmentDate || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-primary">{row.clientName || "—"}</p>
                      <p className="text-outline mt-0.5">{row.serviceName || "—"}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-primary">{row.name}</p>
                      <p className="text-[10px] text-outline uppercase tracking-wider mt-0.5">
                        {row.role === "receptionist" ? "Recepción" : "Manicurista"}
                        {row.percent > 0 ? ` · ${row.percent}%` : ""}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant">
                      {row.reason || "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-display font-black text-amber-900 whitespace-nowrap">
                      −{formatMXN(row.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3">
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-outline">
              Garantías de la semana
            </h4>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Caja $0. Regla fija: se <span className="font-bold text-rose-800">DESCUENTA</span> a
              quien hizo el servicio original y se{" "}
              <span className="font-bold text-emerald-800">SUMA</span> a quien realizó la garantía.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-rose-200">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-rose-50/80 text-[10px] text-outline font-bold uppercase tracking-widest border-b border-rose-100">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Cliente / trabajo</th>
                  <th className="py-3 px-4">Se DESCUENTA (−)</th>
                  <th className="py-3 px-4">Se SUMA (+)</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-6 px-4 text-center text-xs text-outline">
                      Cargando garantías…
                    </td>
                  </tr>
                ) : warrantyRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 px-4 text-center text-xs text-outline">
                      Sin garantías en {weekRangeLabel}.
                    </td>
                  </tr>
                ) : (
                  warrantyRows.map((row, index) => (
                    <tr key={`${row.paymentId}-w-${index}`} className="text-xs">
                      <td className="py-3 px-4 font-mono text-[10px] text-outline font-bold whitespace-nowrap">
                        {row.appointmentDate || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-primary">{row.clientName || "—"}</p>
                        <p className="text-outline mt-0.5">{row.workDescription}</p>
                      </td>
                      <td className="py-3 px-4">
                        {row.sameStaff ? (
                          <p className="text-outline">Misma manicurista · sin traspaso</p>
                        ) : (
                          <>
                            <p className="font-bold text-rose-800">
                              − {row.originalStaffName || "—"}
                            </p>
                            <p className="text-[10px] text-outline mt-0.5">Servicio original</p>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {row.sameStaff ? (
                          <p className="text-outline">—</p>
                        ) : (
                          <>
                            <p className="font-bold text-emerald-800">
                              + {row.performedByStaffName || "—"}
                            </p>
                            <p className="text-[10px] text-outline mt-0.5">Realizó la garantía</p>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {row.sameStaff ? (
                          <span className="font-display font-black text-outline">$0</span>
                        ) : (
                          <span className="font-display font-black text-primary">
                            {formatMXN(row.transferAmount)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
