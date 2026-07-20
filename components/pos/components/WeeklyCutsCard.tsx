"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Scissors } from "lucide-react";
import { formatMXN } from "../data";
import { addDays, getStudioWeekStart } from "../scheduleUtils";
import { useWeeklySnapshot } from "../useWeeklySnapshot";

export default function WeeklyCutsCard() {
  const [weekStart, setWeekStart] = useState<Date>(() => getStudioWeekStart(new Date()));
  const [showDetails, setShowDetails] = useState(false);
  const { snapshot, isLoading, weekRangeLabel, viewingCurrentWeek } = useWeeklySnapshot(weekStart);

  const cutsByTurn = snapshot?.cutsByTurn ?? [];
  const cutsByReceptionist = snapshot?.cutsByReceptionist ?? [];
  const weekCutsCount = snapshot?.cutsCount ?? 0;
  const weekCutsTotal = snapshot?.cutsTotal ?? 0;

  return (
    <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 flex-1">
        <div className="space-y-3 min-w-0 flex-1">
          <span className="text-[10px] text-outline font-bold tracking-widest uppercase block">
            Cortes de Caja
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-outline font-bold uppercase tracking-wider">
                Por turno
              </p>
              <p className="font-display text-3xl font-extrabold text-primary mt-1">
                {isLoading ? "—" : weekCutsCount}
              </p>
              <p className="text-xs font-mono font-bold text-on-surface-variant mt-0.5">
                {isLoading ? "Cargando..." : formatMXN(weekCutsTotal)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-outline font-bold uppercase tracking-wider">
                Por recepcionista
              </p>
              {isLoading ? (
                <p className="text-xs text-outline mt-2">Cargando...</p>
              ) : cutsByReceptionist.length === 0 ? (
                <p className="text-xs text-outline mt-2">Sin cortes en esta semana.</p>
              ) : (
                <div className="mt-1.5 space-y-1">
                  {cutsByReceptionist.map((entry) => (
                    <div
                      key={entry.receptionistId}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="font-sans font-bold text-primary truncate">
                        {entry.name}
                      </span>
                      <span className="font-mono font-bold text-primary shrink-0">
                        {entry.count} · {formatMXN(entry.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-on-surface-variant">
            Turnos cerrados · KPI semanal en Mongo.
          </p>

          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="text-[10px] font-sans font-bold uppercase tracking-wider text-secondary hover:text-primary transition-colors"
          >
            {showDetails ? "Ocultar detalle" : "Ver detalle de cortes"}
          </button>
        </div>

        <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
          <Scissors className="w-6 h-6 text-secondary" />
        </div>
      </div>

      {showDetails && (
        <div className="mt-5 pt-5 border-t border-primary/5 space-y-5 w-full">
          <div className="w-full">
            <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-2">
              Cortes por turno
            </p>
            {cutsByTurn.length === 0 ? (
              <p className="text-xs text-outline">Sin cortes registrados en esta semana.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 w-full">
                {cutsByTurn.map((session) => (
                  <div
                    key={session.sessionCode}
                    className="flex items-center justify-between gap-3 text-xs px-3 py-2.5 rounded-lg bg-surface-container-low/30"
                  >
                    <div className="min-w-0">
                      <p className="font-sans font-bold text-primary truncate">
                        {session.shiftDate}
                      </p>
                      <p className="text-[10px] text-outline truncate">
                        {session.receptionistName}
                        {session.paymentsCount > 0
                          ? ` · ${session.paymentsCount} cobro${session.paymentsCount === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-primary shrink-0">
                      {formatMXN(session.totalAmount || 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-full">
            <p className="text-[10px] text-outline font-bold uppercase tracking-wider mb-2">
              Cortes por recepcionista
            </p>
            {cutsByReceptionist.length === 0 ? (
              <p className="text-xs text-outline">Sin cortes registrados en esta semana.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 w-full">
                {cutsByReceptionist.map((entry) => (
                  <div
                    key={entry.receptionistId}
                    className="flex items-center justify-between gap-3 text-xs px-3 py-2.5 rounded-lg bg-surface-container-low/30"
                  >
                    <div className="min-w-0">
                      <p className="font-sans font-bold text-primary truncate">{entry.name}</p>
                      <p className="text-[10px] text-outline">
                        {entry.count} corte{entry.count === 1 ? "" : "s"} en la semana
                      </p>
                    </div>
                    <span className="font-mono font-bold text-primary shrink-0">
                      {formatMXN(entry.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
