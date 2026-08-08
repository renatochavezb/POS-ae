"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { AlertCircle, Calculator, X } from "lucide-react";
import { Accountant, Appointment, PosPayment, Staff, StaffSettlement } from "../types";
import {
  addDays,
  formatSpanishShortDateFromYmd,
  getMexicoDateYMD,
  getStudioWeekStart,
  ymdAddDays,
} from "../scheduleUtils";
import {
  buildStaffReportPeriodTitle,
  buildStaffReportRows,
  StaffReportPeriod,
} from "../staffWorkReport";
import { formatMXN } from "../data";
import posApi from "@/libs/posApi";
import AccountantPinModal from "./AccountantPinModal";
import { sumDiscountForPerson } from "@/libs/posPaymentDiscounts";
import { warrantyMovementsForStaff } from "@/libs/posWarranty";

type LiquidateMode = "day" | "period";

const DATE_INPUT_CLASS =
  "w-full min-w-0 min-h-[44px] px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary cursor-pointer relative z-10 [color-scheme:light]";

function openNativeDatePicker(event: MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  try {
    if ("showPicker" in input && typeof input.showPicker === "function") {
      input.showPicker();
    }
  } catch {
    // Algunos navegadores bloquean showPicker fuera de un gesto directo.
  }
}

function buildYmdRange(startYmd: string, endYmd: string) {
  if (!startYmd || !endYmd) return [] as string[];
  const labels: string[] = [];
  let cursor = startYmd <= endYmd ? startYmd : endYmd;
  const last = startYmd <= endYmd ? endYmd : startYmd;
  let guard = 0;
  while (cursor <= last && guard < 120) {
    labels.push(cursor);
    cursor = ymdAddDays(cursor, 1);
    guard += 1;
  }
  return labels;
}

type StaffLiquidateModalProps = {
  staff: Staff;
  appointments: Appointment[];
  weekStart: Date;
  isOpen: boolean;
  onClose: () => void;
  onSettled: (settlement: StaffSettlement) => void;
  loggedInAccountant?: { id: string; name: string } | null;
};

export default function StaffLiquidateModal({
  staff,
  appointments,
  weekStart,
  isOpen,
  onClose,
  onSettled,
  loggedInAccountant = null,
}: StaffLiquidateModalProps) {
  const [mode, setMode] = useState<LiquidateMode>("day");
  const [dayYmd, setDayYmd] = useState(() => getMexicoDateYMD(new Date()));
  const [periodStartYmd, setPeriodStartYmd] = useState(() =>
    getMexicoDateYMD(getStudioWeekStart(new Date()))
  );
  const [periodEndYmd, setPeriodEndYmd] = useState(() =>
    getMexicoDateYMD(addDays(getStudioWeekStart(new Date()), 6))
  );
  const [step, setStep] = useState<"period" | "pin">("period");
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodPayments, setPeriodPayments] = useState<PosPayment[]>([]);
  const [isLoadingAdjustments, setIsLoadingAdjustments] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setStep("period");
    setError(null);
    setDayYmd(getMexicoDateYMD(new Date()));
    const currentWeekStart = getStudioWeekStart(new Date());
    setPeriodStartYmd(getMexicoDateYMD(currentWeekStart));
    setPeriodEndYmd(getMexicoDateYMD(addDays(currentWeekStart, 6)));

    posApi
      .getAccountants()
      .then(setAccountants)
      .catch((loadError) => {
        console.error(loadError);
        setError("No se pudo cargar el perfil de contabilidad.");
      });
  }, [isOpen]);

  const dayLabel = formatSpanishShortDateFromYmd(dayYmd);
  const startLabel = mode === "day" ? dayLabel : formatSpanishShortDateFromYmd(periodStartYmd);
  const endLabel = mode === "day" ? dayLabel : formatSpanishShortDateFromYmd(periodEndYmd);
  const startYmd = mode === "day" ? dayYmd : periodStartYmd;
  const endYmd = mode === "day" ? dayYmd : periodEndYmd;

  const period: StaffReportPeriod = useMemo(
    () => ({
      mode,
      startLabel,
      endLabel,
    }),
    [mode, startLabel, endLabel]
  );

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const ymds = buildYmdRange(startYmd, endYmd);

    const load = async () => {
      setIsLoadingAdjustments(true);
      try {
        const results = await Promise.all(
          ymds.map((ymd) =>
            posApi.getPayments({ date: formatSpanishShortDateFromYmd(ymd) })
          )
        );
        if (!cancelled) {
          setPeriodPayments(results.flatMap((result) => result.payments || []));
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) setPeriodPayments([]);
      } finally {
        if (!cancelled) setIsLoadingAdjustments(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, startYmd, endYmd]);

  const previewRows = useMemo(
    () => buildStaffReportRows(appointments, staff, period),
    [appointments, staff, period]
  );

  const periodTitle = buildStaffReportPeriodTitle(period);
  const totalSales = previewRows.reduce((sum, row) => sum + row.cost, 0);
  const commissionFromAppointments = previewRows.reduce(
    (sum, row) => sum + row.commission,
    0
  );
  const discountTotal = sumDiscountForPerson(periodPayments, "staff", staff.id);
  const warrantyMovements = useMemo(
    () => warrantyMovementsForStaff(periodPayments, staff.id),
    [periodPayments, staff.id]
  );
  const warrantyNet = warrantyMovements.reduce(
    (sum, row) => sum + (row.signedAmount || 0),
    0
  );
  const amountToPay = Math.max(
    0,
    Math.round((commissionFromAppointments - discountTotal + warrantyNet) * 100) / 100
  );

  if (!isOpen) return null;

  const handleContinueToPin = () => {
    setError(null);
    if (loggedInAccountant) {
      void handleConfirmSettlement({
        accountantId: loggedInAccountant.id,
        pin: "",
        useSession: true,
      });
      return;
    }
    setStep("pin");
  };

  const handleConfirmSettlement = async ({
    accountantId,
    pin,
    useSession = false,
  }: {
    accountantId: string;
    pin: string;
    useSession?: boolean;
  }) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const settlement = await posApi.createStaffSettlement({
        staffId: staff.id,
        periodMode: mode,
        periodStartLabel: startLabel,
        periodEndLabel: endLabel,
        periodStartYmd: startYmd,
        periodEndYmd: endYmd,
        accountantId,
        ...(useSession ? { accountantSession: true } : { pin }),
      });

      onSettled(settlement);
      onClose();
    } catch (submitError: unknown) {
      console.error(submitError);
      const message =
        typeof submitError === "object" &&
        submitError !== null &&
        "response" in submitError &&
        typeof (submitError as { response?: { data?: { error?: string } } }).response?.data
          ?.error === "string"
          ? (submitError as { response: { data: { error: string } } }).response.data.error
          : "No se pudo registrar la liquidación.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "pin") {
    return (
      <AccountantPinModal
        title="Confirmar liquidación"
        description={`${staff.name} · ${periodTitle} · a pagar ${formatMXN(amountToPay)}`}
        confirmLabel="Liquidar"
        accountants={accountants}
        defaultAccountantId="CO"
        isSubmitting={isSubmitting}
        error={error}
        onConfirm={handleConfirmSettlement}
        onClose={() => {
          if (isSubmitting) return;
          setStep("period");
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-surface-container-lowest max-w-md w-full rounded-2xl border border-primary/5 luxury-shadow max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-primary/5 flex items-start justify-between gap-3">
          <div>
            <span className="text-secondary font-sans text-[10px] font-extrabold uppercase tracking-widest block mb-1">
              Liquidación
            </span>
            <h3 className="font-display text-xl font-bold text-primary">Liquidar comisión</h3>
            <p className="text-xs text-outline mt-1">
              {staff.name} · código {staff.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-outline hover:text-primary transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-visible">
          <div className="flex items-center gap-1 rounded-xl border border-primary/10 bg-surface p-1">
            <button
              type="button"
              onClick={() => setMode("day")}
              className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider transition-colors ${
                mode === "day"
                  ? "bg-primary text-on-primary"
                  : "text-primary hover:bg-surface-container-low"
              }`}
            >
              Un día
            </button>
            <button
              type="button"
              onClick={() => setMode("period")}
              className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider transition-colors ${
                mode === "period"
                  ? "bg-primary text-on-primary"
                  : "text-primary hover:bg-surface-container-low"
              }`}
            >
              Periodo
            </button>
          </div>

          {mode === "day" ? (
            <label className="space-y-1 block">
              <span className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                Día a liquidar
              </span>
              <input
                type="date"
                value={dayYmd}
                onClick={openNativeDatePicker}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next) setDayYmd(next);
                }}
                className={DATE_INPUT_CLASS}
              />
            </label>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-visible">
              <label className="space-y-1 min-w-0">
                <span className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                  Desde
                </span>
                <input
                  type="date"
                  value={periodStartYmd}
                  max={periodEndYmd}
                  onClick={openNativeDatePicker}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (!next) return;
                    setPeriodStartYmd(next);
                    if (next > periodEndYmd) setPeriodEndYmd(next);
                  }}
                  className={DATE_INPUT_CLASS}
                />
              </label>
              <label className="space-y-1 min-w-0">
                <span className="text-[10px] text-outline font-bold uppercase tracking-wider block">
                  Hasta
                </span>
                <input
                  type="date"
                  value={periodEndYmd}
                  min={periodStartYmd}
                  onClick={openNativeDatePicker}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (!next) return;
                    setPeriodEndYmd(next);
                    if (next < periodStartYmd) setPeriodStartYmd(next);
                  }}
                  className={DATE_INPUT_CLASS}
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("day");
                setDayYmd(getMexicoDateYMD(new Date()));
              }}
              className="px-3 py-1.5 rounded-lg border border-primary/10 text-[10px] font-sans font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low transition-colors"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => {
                const start = getStudioWeekStart(new Date());
                setMode("period");
                setPeriodStartYmd(getMexicoDateYMD(start));
                setPeriodEndYmd(getMexicoDateYMD(addDays(start, 6)));
              }}
              className="px-3 py-1.5 rounded-lg border border-primary/10 text-[10px] font-sans font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low transition-colors"
            >
              Semana actual
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("period");
                setPeriodStartYmd(getMexicoDateYMD(weekStart));
                setPeriodEndYmd(getMexicoDateYMD(addDays(weekStart, 6)));
              }}
              className="px-3 py-1.5 rounded-lg border border-primary/10 text-[10px] font-sans font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low transition-colors"
            >
              Semana del gráfico
            </button>
          </div>

          <div className="rounded-xl border border-primary/10 bg-surface-container-low/40 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Calculator className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-primary">{periodTitle}</p>
                <p className="text-[11px] text-outline mt-1">
                  {previewRows.length} cita{previewRows.length === 1 ? "" : "s"} · ventas{" "}
                  {formatMXN(totalSales)}
                  {isLoadingAdjustments ? " · cargando ajustes…" : ""}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs border-t border-primary/10 pt-3">
              <div className="flex justify-between gap-3">
                <span className="text-outline">Comisión de citas</span>
                <span className="font-mono font-bold text-primary">
                  {formatMXN(commissionFromAppointments)}
                </span>
              </div>
              {discountTotal > 0 ? (
                <div className="flex justify-between gap-3">
                  <span className="text-amber-900 font-bold">− Descuentos de comisión</span>
                  <span className="font-mono font-bold text-amber-900">
                    −{formatMXN(discountTotal)}
                  </span>
                </div>
              ) : null}
              {warrantyMovements.map((row, index) => (
                <div
                  key={`${row.paymentId}-${row.type}-${index}`}
                  className="rounded-lg bg-white/70 border border-rose-100 px-2.5 py-2 space-y-0.5"
                >
                  <div className="flex justify-between gap-3">
                    <span
                      className={`font-bold ${
                        row.signedAmount < 0
                          ? "text-rose-800"
                          : row.signedAmount > 0
                            ? "text-emerald-800"
                            : "text-outline"
                      }`}
                    >
                      {row.signedAmount < 0
                        ? "− Garantía (se le quita)"
                        : row.signedAmount > 0
                          ? "+ Garantía (se le suma)"
                          : "Garantía (sin traspaso)"}
                    </span>
                    <span
                      className={`font-mono font-bold shrink-0 ${
                        row.signedAmount < 0
                          ? "text-rose-800"
                          : row.signedAmount > 0
                            ? "text-emerald-800"
                            : "text-outline"
                      }`}
                    >
                      {row.signedAmount === 0
                        ? formatMXN(0)
                        : `${row.signedAmount > 0 ? "+" : "−"}${formatMXN(Math.abs(row.signedAmount))}`}
                    </span>
                  </div>
                  <p className="text-[10px] text-outline leading-snug">
                    {row.clientName || "Cliente"} · {row.workDescription}
                    {!row.sameStaff
                      ? row.signedAmount < 0
                        ? ` · original ${staff.name}, realizó ${row.performedByStaffName}`
                        : ` · realizó ${staff.name}, original ${row.originalStaffName}`
                      : null}
                  </p>
                </div>
              ))}
              <div className="flex justify-between gap-3 pt-2 border-t border-primary/10">
                <span className="font-bold text-primary uppercase tracking-wider text-[10px]">
                  Total a pagar
                </span>
                <span className="font-display text-lg font-extrabold text-secondary">
                  {formatMXN(amountToPay)}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-outline leading-relaxed">
              Regla de garantía: a quien inició el trabajo se le <strong>quita</strong>; a quien lo
              terminó (realizó la garantía) se le <strong>suma</strong>. Este total es el que se
              guarda al liquidar.
            </p>
          </div>

          {previewRows.length === 0 && warrantyMovements.length === 0 ? (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              No hay citas terminadas ni garantías en este periodo. Puedes continuar para registrar
              liquidación en cero o cambiar las fechas.
            </div>
          ) : null}

          {error ? (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-primary/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-primary/10 text-outline hover:text-primary rounded-lg text-xs font-sans font-bold uppercase tracking-wider transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleContinueToPin}
              disabled={isSubmitting || isLoadingAdjustments}
              className="px-4 py-2 rounded-lg text-xs font-sans font-bold uppercase tracking-wider bg-primary text-on-primary hover:bg-primary-container disabled:opacity-40"
            >
              {isSubmitting ? "Registrando..." : loggedInAccountant ? "Liquidar" : "Continuar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
