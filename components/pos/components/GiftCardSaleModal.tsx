"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  Banknote,
  Check,
  Copy,
  CreditCard,
  Gift,
  Loader2,
  Wallet,
  X,
} from "lucide-react";
import { PaymentMethod, PosGiftCard, Receptionist } from "../types";
import { formatMXN } from "../data";
import posApi from "@/libs/posApi";

type GiftCardPurchaseMethod = Exclude<PaymentMethod, "gift_card">;

interface GiftCardSaleModalProps {
  receptionist: Receptionist | null;
  onClose: () => void;
  onSold: () => Promise<void> | void;
}

const PURCHASE_METHODS: Array<{
  id: GiftCardPurchaseMethod;
  label: string;
  icon: typeof Banknote;
}> = [
  { id: "efectivo", label: "Efectivo", icon: Banknote },
  { id: "tarjeta", label: "Tarjeta", icon: CreditCard },
  { id: "transferencia", label: "Transferencia", icon: ArrowRightLeft },
  { id: "mixto", label: "Mixto", icon: Wallet },
];

const inputClassName =
  "w-full px-3 py-2.5 border border-primary/10 rounded-lg text-sm font-bold text-primary bg-surface outline-none focus:border-secondary";

export default function GiftCardSaleModal({
  receptionist,
  onClose,
  onSold,
}: GiftCardSaleModalProps) {
  const [value, setValue] = useState("");
  const [method, setMethod] = useState<GiftCardPurchaseMethod>("efectivo");
  const [cashAmount, setCashAmount] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soldGiftCard, setSoldGiftCard] = useState<PosGiftCard | null>(null);
  const [copied, setCopied] = useState(false);

  const cardValue = Number(value) || 0;

  const handleSubmit = async () => {
    if (cardValue <= 0) {
      setError("Ingresa un valor mayor a cero.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await posApi.sellGiftCard({
        value: cardValue,
        method,
        ...(method === "mixto"
          ? {
              cashAmount: Number(cashAmount) || 0,
              cardAmount: Number(cardAmount) || 0,
              transferAmount: Number(transferAmount) || 0,
            }
          : {}),
        notes,
        processedByReceptionistId: receptionist?.id || "",
        processedByReceptionistName: receptionist?.name || "Administrador",
      });
      setSoldGiftCard(result.giftCard);
      await onSold();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo vender la gift card"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCode = async () => {
    if (!soldGiftCard) return;
    await navigator.clipboard.writeText(soldGiftCard.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-surface-container-lowest w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-primary/10 luxury-shadow overflow-hidden max-h-[92dvh] flex flex-col">
        <div className="px-5 py-4 border-b border-primary/5 bg-surface-container-low/40 flex items-start justify-between gap-3">
          <div>
            <span className="text-secondary text-[10px] font-extrabold uppercase tracking-widest block">
              Venta directa
            </span>
            <h3 className="font-display text-xl font-bold text-primary">
              Vender Gift Card
            </h3>
            <p className="text-xs text-outline mt-1">
              Sin cita ni asignación de manicurista.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-outline hover:text-primary transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {soldGiftCard ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center">
                <Check className="w-8 h-8 text-emerald-700 mx-auto" />
                <p className="font-display text-lg font-bold text-emerald-950 mt-2">
                  Gift Card vendida
                </p>
                <p className="font-display text-3xl font-black text-primary mt-4">
                  {formatMXN(soldGiftCard.initialValue)}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-outline mt-1">
                  Saldo disponible
                </p>
              </div>

              <div className="rounded-xl border border-primary/10 bg-surface p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                  Código para canjear
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 text-center text-xl font-black tracking-widest text-primary">
                    {soldGiftCard.code}
                  </code>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="p-2.5 rounded-lg bg-primary text-on-primary"
                    title="Copiar código"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-wider"
              >
                Finalizar
              </button>
            </div>
          ) : (
            <>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                  Valor de la Gift Card
                </span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-primary">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    className={`${inputClassName} pl-7`}
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </label>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-outline mb-2">
                  Método de pago de la compra
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PURCHASE_METHODS.map((option) => {
                    const Icon = option.icon;
                    const active = method === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setMethod(option.id)}
                        className={`px-3 py-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors ${
                          active
                            ? "bg-primary text-on-primary border-primary"
                            : "bg-surface border-primary/10 text-outline hover:border-secondary"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {method === "mixto" ? (
                <div className="grid grid-cols-3 gap-2">
                  <label className="space-y-1">
                    <span className="text-[9px] font-bold uppercase text-outline">Efectivo</span>
                    <input
                      type="number"
                      min="0"
                      value={cashAmount}
                      onChange={(event) => setCashAmount(event.target.value)}
                      className={inputClassName}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[9px] font-bold uppercase text-outline">Tarjeta</span>
                    <input
                      type="number"
                      min="0"
                      value={cardAmount}
                      onChange={(event) => setCardAmount(event.target.value)}
                      className={inputClassName}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[9px] font-bold uppercase text-outline">Transf.</span>
                    <input
                      type="number"
                      min="0"
                      value={transferAmount}
                      onChange={(event) => setTransferAmount(event.target.value)}
                      className={inputClassName}
                    />
                  </label>
                </div>
              ) : null}

              <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                  Notas (opcional)
                </span>
                <input
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={inputClassName}
                  placeholder="Referencia o comentario"
                />
              </label>

              {error ? (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
                  {error}
                </div>
              ) : null}

              <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 flex items-center justify-between">
                <span className="text-xs font-bold text-primary">Total a cobrar</span>
                <span className="font-display text-xl font-black text-primary">
                  {formatMXN(cardValue)}
                </span>
              </div>

              <button
                type="button"
                disabled={isSubmitting || cardValue <= 0}
                onClick={handleSubmit}
                className="w-full py-3 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:bg-primary-container disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Gift className="w-4 h-4 text-secondary" />
                )}
                {isSubmitting ? "Procesando…" : "Cobrar y generar Gift Card"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
