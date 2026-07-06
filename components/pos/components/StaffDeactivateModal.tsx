"use client";

import { AlertCircle, UserX, X } from "lucide-react";
import { Staff } from "../types";

type StaffDeactivateModalProps = {
  staff: Staff;
  isSubmitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export default function StaffDeactivateModal({
  staff,
  isSubmitting = false,
  error = null,
  onConfirm,
  onClose,
}: StaffDeactivateModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-surface max-w-sm w-full rounded-2xl border border-primary/10 luxury-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-primary/5 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-primary">Dar de baja</h3>
            <p className="text-xs text-outline mt-1">
              {staff.name} · {staff.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-outline hover:text-primary transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Se ocultará del equipo y del login. En la agenda seguirá visible el
            día de la baja y todos los días anteriores; a partir del día
            siguiente a la baja ya no tendrá columna. El historial se conserva
            en la base de datos.
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-primary/10 text-outline hover:text-primary rounded-lg text-xs font-sans font-bold uppercase tracking-wider transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-sans font-bold uppercase tracking-wider bg-red-700 text-white hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <UserX className="w-4 h-4" />
              {isSubmitting ? "Procesando..." : "Dar de baja"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
