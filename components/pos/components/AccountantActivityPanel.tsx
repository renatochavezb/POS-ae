"use client";

import { useEffect, useState } from "react";
import { Clock3, Download, LogIn, LogOut, Wallet } from "lucide-react";
import posApi from "@/libs/posApi";
import { AccountantActivity } from "../types";
import { formatMXN } from "../data";

type AccountantActivityPanelProps = {
  accountantId: string;
  accountantName?: string;
  staffId?: string;
  limit?: number;
  refreshKey?: number;
};

const ACTION_LABELS: Record<AccountantActivity["action"], string> = {
  login: "Ingreso",
  logout: "Salida",
  report_download: "Reporte descargado",
  liquidation: "Liquidación",
};

function ActionIcon({ action }: { action: AccountantActivity["action"] }) {
  if (action === "login") return <LogIn className="w-3.5 h-3.5" />;
  if (action === "logout") return <LogOut className="w-3.5 h-3.5" />;
  if (action === "report_download") return <Download className="w-3.5 h-3.5" />;
  return <Wallet className="w-3.5 h-3.5" />;
}

export default function AccountantActivityPanel({
  accountantId,
  accountantName,
  staffId,
  limit = 50,
  refreshKey = 0,
}: AccountantActivityPanelProps) {
  const [activities, setActivities] = useState<AccountantActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    posApi
      .getAccountantActivities({
        accountantId,
        staffId,
        limit,
      })
      .then((items) => {
        if (!cancelled) setActivities(items);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setActivities([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountantId, staffId, limit, refreshKey]);

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-primary/5 luxury-shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-primary/5 flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] text-outline font-bold uppercase tracking-widest block">
            Bitácora contabilidad
          </span>
          <h3 className="font-display text-lg font-bold text-primary">
            Movimientos {accountantName ? `· ${accountantName}` : ""}
          </h3>
        </div>
        <Clock3 className="w-5 h-5 text-secondary shrink-0" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low/50 text-[10px] text-outline font-bold uppercase tracking-widest border-b border-primary/5">
              <th className="py-3 px-5">Fecha</th>
              <th className="py-3 px-5">Hora</th>
              <th className="py-3 px-5">Acción</th>
              <th className="py-3 px-5">Manicurista</th>
              <th className="py-3 px-5">Periodo</th>
              <th className="py-3 px-5 text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/5">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 px-5 text-center text-xs text-outline">
                  Cargando movimientos...
                </td>
              </tr>
            ) : activities.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 px-5 text-center text-xs text-outline">
                  Sin movimientos registrados todavía.
                </td>
              </tr>
            ) : (
              activities.map((item) => {
                const periodLabel =
                  item.periodStartLabel && item.periodEndLabel
                    ? item.periodStartLabel === item.periodEndLabel
                      ? item.periodStartLabel
                      : `${item.periodStartLabel} – ${item.periodEndLabel}`
                    : "—";

                return (
                  <tr key={item.id} className="hover:bg-surface-container-low/30 transition-colors">
                    <td className="py-3 px-5 text-xs font-bold text-primary">
                      {item.activityDateLabel}
                    </td>
                    <td className="py-3 px-5 font-mono text-xs text-outline">
                      {item.activityTimeLabel}
                    </td>
                    <td className="py-3 px-5">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        <ActionIcon action={item.action} />
                        {ACTION_LABELS[item.action]}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-xs text-on-surface-variant">
                      {item.staffName || "—"}
                    </td>
                    <td className="py-3 px-5 text-xs text-on-surface-variant">{periodLabel}</td>
                    <td className="py-3 px-5 text-right text-xs font-bold text-secondary">
                      {item.paidAmount > 0 ? formatMXN(item.paidAmount) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
