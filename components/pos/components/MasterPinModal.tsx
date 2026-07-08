"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, Shield, X } from "lucide-react";
import NumericKeypad from "./NumericKeypad";

type MasterPinModalProps = {
  title: string;
  description: string;
  confirmLabel: string;
  isSubmitting?: boolean;
  error?: string | null;
  onConfirm: (pin: string) => void;
  onClose: () => void;
};

export default function MasterPinModal({
  title,
  description,
  confirmLabel,
  isSubmitting = false,
  error = null,
  onConfirm,
  onClose,
}: MasterPinModalProps) {
  const [pin, setPin] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    setLocalError(null);

    if (pin.length !== 4) {
      setLocalError("Ingresa la clave de administrador de 4 dígitos.");
      return;
    }

    onConfirm(pin);
  };

  const displayError = error || localError;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-surface max-w-sm w-full max-h-[95vh] overflow-y-auto rounded-2xl border border-primary/10 luxury-shadow">
        <div className="px-5 py-4 border-b border-primary/5 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
              <Shield className="w-4 h-4 text-secondary shrink-0" />
              {title}
            </h3>
            <p className="text-xs text-outline mt-1">{description}</p>
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] text-outline font-bold uppercase tracking-wider block">
              Clave de administrador
            </label>
            <p className="text-[10px] text-outline">Toca los números en pantalla</p>
            <NumericKeypad
              value={pin}
              onChange={setPin}
              maxLength={4}
              disabled={isSubmitting}
              variant="light"
              showDots
            />
          </div>

          {displayError ? (
            <p className="text-xs text-red-600 flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {displayError}
            </p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-lg border border-primary/10 text-xs font-bold uppercase tracking-wider text-outline hover:bg-surface-container-low transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || pin.length !== 4}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
            >
              {isSubmitting ? "Validando..." : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
