"use client";

import { Delete } from "lucide-react";

type NumericKeypadProps = {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
  variant?: "login" | "light";
  onComplete?: (value: string) => void;
  showDots?: boolean;
};

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function NumericKeypad({
  value,
  onChange,
  maxLength = 4,
  disabled = false,
  variant = "light",
  onComplete,
  showDots = false,
}: NumericKeypadProps) {
  const isLogin = variant === "login";

  const appendDigit = (digit: string) => {
    if (disabled || value.length >= maxLength) return;
    const next = `${value}${digit}`.slice(0, maxLength);
    onChange(next);
    if (next.length === maxLength) {
      onComplete?.(next);
    }
  };

  const backspace = () => {
    if (disabled || value.length === 0) return;
    onChange(value.slice(0, -1));
  };

  const clear = () => {
    if (disabled) return;
    onChange("");
  };

  const keyClass = isLogin
    ? "min-h-[2.65rem] sm:min-h-[3.25rem] rounded-xl border border-[#e5c158]/25 bg-[#00261b] text-[#e5c158] text-lg sm:text-xl font-bold transition-all active:scale-[0.97] hover:bg-[#e5c158]/10 disabled:opacity-40 touch-manipulation"
    : "min-h-[2.5rem] sm:min-h-[3rem] rounded-xl border border-primary/10 bg-surface text-primary text-base sm:text-lg font-bold transition-all active:scale-[0.97] hover:bg-surface-container-low disabled:opacity-40 touch-manipulation";

  const actionClass = isLogin
    ? "min-h-[2.65rem] sm:min-h-[3.25rem] rounded-xl border border-[#e5c158]/20 bg-[#e5c158]/8 text-[#e5c158] text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.97] hover:bg-[#e5c158]/15 disabled:opacity-40 touch-manipulation"
    : "min-h-[2.5rem] sm:min-h-[3rem] rounded-xl border border-primary/10 bg-surface-container-low text-outline text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.97] hover:bg-surface-container disabled:opacity-40 touch-manipulation";

  return (
    <div className="w-full max-w-xs mx-auto select-none">
      {showDots ? (
        <div className="flex justify-center gap-3 mb-3">
          {Array.from({ length: maxLength }).map((_, index) => (
            <div
              key={index}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                isLogin
                  ? value.length > index
                    ? "bg-[#e5c158] border-[#e5c158]"
                    : "border-[#e5c158]/35"
                  : value.length > index
                    ? "bg-primary border-primary"
                    : "border-primary/25"
              }`}
            />
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => appendDigit(digit)}
            className={keyClass}
          >
            {digit}
          </button>
        ))}

        <button type="button" disabled={disabled} onClick={clear} className={actionClass}>
          Borrar
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => appendDigit("0")}
          className={keyClass}
        >
          0
        </button>
        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={backspace}
          className={`${actionClass} inline-flex items-center justify-center gap-1`}
          aria-label="Eliminar último dígito"
        >
          <Delete className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
