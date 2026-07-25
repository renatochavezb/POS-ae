"use client";

import { AlertTriangle, Ban, RotateCcw, Trash2, X } from "lucide-react";
import { AppointmentStatus } from "../types";
import {
  getAppointmentStatusLabel,
  getPreviousAppointmentStatus,
} from "../appointmentStatus";

export type AdminAppointmentAction = "revert" | "cancel" | "delete";

type AdminAppointmentConfirmModalProps = {
  action: AdminAppointmentAction;
  clientName: string;
  date: string;
  time: string;
  staffName: string;
  status: AppointmentStatus;
  isPaid: boolean;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

const ACTION_COPY: Record<
  AdminAppointmentAction,
  { title: string; verb: string; confirm: string; icon: typeof Trash2 }
> = {
  revert: {
    title: "Retroceder estatus",
    verb: "retroceder",
    confirm: "Retroceder",
    icon: RotateCcw,
  },
  cancel: {
    title: "Cancelar cita",
    verb: "cancelar",
    confirm: "Cancelar cita",
    icon: Ban,
  },
  delete: {
    title: "Eliminar cita",
    verb: "eliminar",
    confirm: "Eliminar definitivamente",
    icon: Trash2,
  },
};

export default function AdminAppointmentConfirmModal({
  action,
  clientName,
  date,
  time,
  staffName,
  status,
  isPaid,
  isSubmitting = false,
  onConfirm,
  onClose,
}: AdminAppointmentConfirmModalProps) {
  const copy = ACTION_COPY[action];
  const Icon = copy.icon;
  const previous = getPreviousAppointmentStatus(status);
  const statusLabel = getAppointmentStatusLabel(status);

  return (
    <div className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl border border-primary/10 luxury-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-primary/5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                Solo administrador
              </p>
              <h3 className="font-display text-xl font-bold text-primary">{copy.title}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-outline hover:text-primary transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-primary/10 bg-surface-container-low/40 px-4 py-3 space-y-1">
            <p className="font-sans font-bold text-sm text-primary">{clientName}</p>
            <p className="text-xs text-outline">
              {date} · {time || "Sin hora"} · {staffName}
            </p>
            <p className="text-[11px] text-on-surface-variant">
              Estatus actual: <span className="font-bold text-primary">{statusLabel}</span>
              {action === "revert" && previous ? (
                <>
                  {" "}
                  →{" "}
                  <span className="font-bold text-secondary">
                    {getAppointmentStatusLabel(previous)}
                  </span>
                </>
              ) : null}
              {action === "cancel" ? (
                <>
                  {" "}
                  → <span className="font-bold text-red-700">Cancelada</span>
                </>
              ) : null}
            </p>
          </div>

          <div
            className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
              isPaid
                ? "bg-amber-50 border-amber-200 text-amber-950"
                : "bg-emerald-50 border-emerald-200 text-emerald-950"
            }`}
          >
            <AlertTriangle
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                isPaid ? "text-amber-700" : "text-emerald-700"
              }`}
            />
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-wider">
                {isPaid ? "Esta cita está pagada" : "Esta cita no está pagada"}
              </p>
              <p className="text-[11px] mt-1 leading-relaxed">
                {isPaid
                  ? "Hay un cobro registrado en caja. Si continúas, el estatus o la cita cambiarán, pero el pago no se borra automáticamente."
                  : "No hay cobro ligado en caja. Puedes continuar con la acción."}
              </p>
            </div>
          </div>

          <p className="text-xs text-outline">
            ¿Confirmas {copy.verb} esta cita?
            {action === "delete"
              ? " La eliminación es permanente y no se puede deshacer."
              : ""}
          </p>
        </div>

        <div className="p-5 border-t border-primary/5 flex flex-col-reverse sm:flex-row gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 rounded-xl border border-primary/10 text-xs font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low disabled:opacity-40"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`flex-1 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-40 ${
              action === "delete" || action === "cancel"
                ? "bg-red-700 text-white hover:bg-red-800"
                : "bg-primary text-on-primary hover:bg-primary-container"
            }`}
          >
            {isSubmitting ? "Procesando…" : copy.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
