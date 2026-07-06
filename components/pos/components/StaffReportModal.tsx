"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { AlertCircle, Download, FileText, X } from "lucide-react";
import { Appointment, Staff } from "../types";
import {
  addDays,
  formatSpanishShortDateFromYmd,
  getMexicoDateYMD,
  getMonday,
  getTodaySpanishShortDate,
} from "../scheduleUtils";
import posApi from "@/libs/posApi";
import {
  buildStaffReportPeriodTitle,
  buildStaffReportRows,
  openStaffWorkReportPrint,
  StaffReportPeriod,
} from "../staffWorkReport";

type ReportMode = "day" | "period";

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

type StaffReportModalProps = {
  staff: Staff;
  appointments: Appointment[];
  weekStart: Date;
  isOpen: boolean;
  onClose: () => void;
  loggedInAccountant?: { id: string; name: string } | null;
  onActivityRecorded?: () => void;
};

export default function StaffReportModal({
  staff,
  appointments,
  weekStart,
  isOpen,
  onClose,
  loggedInAccountant = null,
  onActivityRecorded,
}: StaffReportModalProps) {
  const [mode, setMode] = useState<ReportMode>("day");
  const [dayYmd, setDayYmd] = useState(() => getMexicoDateYMD(new Date()));
  const [periodStartYmd, setPeriodStartYmd] = useState(() => getMexicoDateYMD(getMonday(new Date())));
  const [periodEndYmd, setPeriodEndYmd] = useState(() =>
    getMexicoDateYMD(addDays(getMonday(new Date()), 6))
  );
  const [isRecording, setIsRecording] = useState(false);

  const todayLabel = getTodaySpanishShortDate();
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

  const handleUseToday = () => {
    setMode("day");
    setDayYmd(getMexicoDateYMD(new Date()));
  };

  const handleUseCurrentWeek = () => {
    const start = getMonday(new Date());
    setMode("period");
    setPeriodStartYmd(getMexicoDateYMD(start));
    setPeriodEndYmd(getMexicoDateYMD(addDays(start, 6)));
  };

  const handleUseChartWeek = () => {
    setMode("period");
    setPeriodStartYmd(getMexicoDateYMD(weekStart));
    setPeriodEndYmd(getMexicoDateYMD(addDays(weekStart, 6)));
  };

  const handleGenerate = async () => {
    setIsRecording(true);

    if (loggedInAccountant?.id) {
      try {
        await posApi.recordAccountantActivity({
          accountantId: loggedInAccountant.id,
          action: "report_download",
          staffId: staff.id,
          staffName: staff.name,
          periodMode: mode,
          periodStartLabel: startLabel,
          periodEndLabel: endLabel,
          periodStartYmd: startYmd,
          periodEndYmd: endYmd,
          appointmentCount: previewRows.length,
          grossAmount: totalSales,
          paidAmount: totalCommission,
        });
        onActivityRecorded?.();
      } catch (error) {
        console.error(error);
      }
    }

    openStaffWorkReportPrint({
      staff,
      rows: previewRows,
      period,
    });
    setIsRecording(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-surface-container-lowest max-w-md w-full rounded-2xl border border-primary/5 luxury-shadow max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-primary/5 flex items-start justify-between gap-3">
          <div>
            <span className="text-secondary font-sans text-[10px] font-extrabold uppercase tracking-widest block mb-1">
              Reporte
            </span>
            <h3 className="font-display text-xl font-bold text-primary">Descargar reporte</h3>
            <p className="text-xs text-outline mt-1">
              {staff.name} · elige el periodo a exportar
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
                Día del reporte
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
              onClick={handleUseToday}
              className="px-3 py-1.5 rounded-lg border border-primary/10 text-[10px] font-sans font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low transition-colors"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={handleUseCurrentWeek}
              className="px-3 py-1.5 rounded-lg border border-primary/10 text-[10px] font-sans font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low transition-colors"
            >
              Semana actual
            </button>
            <button
              type="button"
              onClick={handleUseChartWeek}
              className="px-3 py-1.5 rounded-lg border border-primary/10 text-[10px] font-sans font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low transition-colors"
            >
              Semana del gráfico
            </button>
          </div>

          <div className="rounded-xl border border-primary/10 bg-surface-container-low/40 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-primary">{periodTitle}</p>
                <p className="text-[11px] text-outline mt-1">
                  {previewRows.length} cita{previewRows.length === 1 ? "" : "s"} pagada
                  {previewRows.length === 1 ? "" : "s"}
                  {previewRows.length > 0
                    ? ` · ${new Intl.NumberFormat("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      }).format(totalSales)} bruto · ${new Intl.NumberFormat("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      }).format(totalCommission)} comisión`
                    : ""}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-outline leading-relaxed">
              El reporte se abre listo para imprimir o guardar como PDF. Por defecto cabe en
              una hoja; si el periodo tiene muchas citas, continuará en páginas adicionales.
            </p>
            {dayLabel === todayLabel && mode === "day" ? (
              <p className="text-[10px] text-on-surface-variant">
                Atajo rápido: reporte del día de hoy.
              </p>
            ) : null}
          </div>

          {previewRows.length === 0 ? (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              No hay citas pagadas en este periodo. Puedes generar el reporte vacío o cambiar las
              fechas.
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
              onClick={handleGenerate}
              disabled={isRecording}
              className="px-4 py-2 rounded-lg text-xs font-sans font-bold uppercase tracking-wider bg-primary text-on-primary hover:bg-primary-container flex items-center gap-2 disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              {isRecording ? "Registrando..." : "Generar reporte"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
