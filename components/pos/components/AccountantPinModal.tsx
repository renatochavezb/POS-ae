"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { Accountant } from "../types";

export type AccountantAuthPayload = {
  accountantId: string;
  pin: string;
};

type AccountantPinModalProps = {
  title: string;
  description: string;
  confirmLabel: string;
  accountants: Accountant[];
  defaultAccountantId?: string | null;
  isSubmitting?: boolean;
  error?: string | null;
  onConfirm: (auth: AccountantAuthPayload) => void;
  onClose: () => void;
};

export default function AccountantPinModal({
  title,
  description,
  confirmLabel,
  accountants,
  defaultAccountantId,
  isSubmitting = false,
  error = null,
  onConfirm,
  onClose,
}: AccountantPinModalProps) {
  const [accountantId, setAccountantId] = useState(
    defaultAccountantId || accountants[0]?.id || ""
  );
  const [pin, setPin] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAccountantId(defaultAccountantId || accountants[0]?.id || "");
  }, [accountants, defaultAccountantId]);

  useEffect(() => {
    const timer = window.setTimeout(() => pinRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    setLocalError(null);

    if (!accountantId) {
      setLocalError("Selecciona una contadora.");
      return;
    }

    if (pin.length !== 4) {
      setLocalError("Ingresa la clave de 4 dígitos.");
      return;
    }

    onConfirm({ accountantId, pin });
  };

  const displayError = error || localError;

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-surface max-w-sm w-full rounded-2xl border border-primary/10 luxury-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-primary/5 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-primary">{title}</h3>
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4" autoComplete="off">
          <label className="block space-y-1">
            <span className="text-[10px] text-outline font-bold uppercase tracking-wider">
              Contadora
            </span>
            <select
              value={accountantId}
              onChange={(event) => setAccountantId(event.target.value)}
              className="w-full px-3 py-2 border border-primary/10 rounded-lg text-xs font-sans font-bold text-primary bg-surface outline-none focus:border-secondary"
              disabled={isSubmitting}
            >
              <option value="">Seleccionar...</option>
              {accountants.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.id}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] text-outline font-bold uppercase tracking-wider">
              Clave de contabilidad
            </span>
            <input
              ref={pinRef}
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
                if (localError) setLocalError(null);
              }}
              className="w-full px-3 py-2.5 border border-primary/10 rounded-lg text-sm font-sans font-bold text-primary bg-surface outline-none focus:border-secondary tracking-[0.45em] text-center"
              placeholder="••••"
              autoComplete="off"
              disabled={isSubmitting}
            />
          </label>

          {displayError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {displayError}
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
              type="submit"
              disabled={isSubmitting || pin.length !== 4 || !accountantId}
              className="px-4 py-2 rounded-lg text-xs font-sans font-bold uppercase tracking-wider bg-primary text-on-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Registrando..." : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
