"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Calculator, X } from "lucide-react";
import { Accountant, Appointment, Staff, StaffSettlement } from "../types";
import {
  addDays,
  formatSpanishShortDateFromYmd,
  getMexicoDateYMD,
  getMonday,
} from "../scheduleUtils";
import {
  buildStaffReportPeriodTitle,
  buildStaffReportRows,
  StaffReportPeriod,
} from "../staffWorkReport";
import { formatMXN } from "../data";
import posApi from "@/libs/posApi";
import AccountantPinModal from "./AccountantPinModal";

type LiquidateMode = "day" | "period";

const DATE_INPUT_CLASS =
  "w-full min-w-0 min-h-[44px] px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary cursor-pointer relative z-10 [color-scheme:light]";

function openNativeDatePicker(event: React.MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  try {
    if ("showPicker" in input && typeof input.showPicker === "function") {
      input.showPicker();
    }
  } catch {
    // Algunos navegadores bloquean showPicker fuera de un gesto directo.
  }
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
  const [periodStartYmd, setPeriodStartYmd] = useState(() => getMexicoDateYMD(getMonday(new Date())));
  const [periodEndYmd, setPeriodEndYmd] = useState(() =>
    getMexicoDateYMD(addDays(getMonday(new Date()), 6))
  );
  const [step, setStep] = useState<"period" | "pin">("period");
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setStep("period");
    setError(null);
    setDayYmd(getMexicoDateYMD(new Date()));
    const weekStartMonday = getMonday(new Date());
    setPeriodStartYmd(getMexicoDateYMD(weekStartMonday));
    setPeriodEndYmd(getMexicoDateYMD(addDays(weekStartMonday, 6)));

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

  const previewRows = useMemo(
    () => buildStaffReportRows(appointments, staff, period),
    [appointments, staff, period]
  );

  const periodTitle = buildStaffReportPeriodTitle(period);
  const totalSales = previewRows.reduce((sum, row) => sum + row.cost, 0);
  const totalCommission = previewRows.reduce((sum, row) => sum + row.commission, 0);

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
        description={`${staff.name} · ${periodTitle} · ${formatMXN(totalCommission)}`}
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
                const start = getMonday(new Date());
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

          <div className="rounded-xl border border-primary/10 bg-surface-container-low/40 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Calculator className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-primary">{periodTitle}</p>
                <p className="text-[11px] text-outline mt-1">
                  {previewRows.length} cita{previewRows.length === 1 ? "" : "s"} · Bruto{" "}
                  {formatMXN(totalSales)} · A pagar {formatMXN(totalCommission)}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-outline leading-relaxed">
              Al confirmar se guardará en MongoDB la fecha de liquidación, el periodo y el monto
              pagado. Se solicitará la clave de contabilidad.
            </p>
          </div>

          {previewRows.length === 0 ? (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              No hay citas pagadas en este periodo. Puedes continuar para registrar liquidación en
              cero o cambiar las fechas.
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
              disabled={isSubmitting}
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
