"use client";

import { useMemo } from "react";
import { Clock } from "lucide-react";
import { Staff } from "../types";
import { getBookableStaff } from "@/libs/posStaffAgenda";

/** Fallback si aún no llega la config desde Mongo. */
export const DEFAULT_CABIN_CAPACITY = 12;

type CabinOccupancyCardProps = {
  staffList: Staff[];
  /** Capacidad física de cabinas (PosScheduleConfig.cabinCapacity en Mongo). */
  cabinCapacity?: number;
};

export default function CabinOccupancyCard({
  staffList,
  cabinCapacity = DEFAULT_CABIN_CAPACITY,
}: CabinOccupancyCardProps) {
  const capacity = Math.max(1, Math.round(Number(cabinCapacity) || DEFAULT_CABIN_CAPACITY));
  const registeredCount = useMemo(() => getBookableStaff(staffList).length, [staffList]);

  const occupancyPercent = Math.round((registeredCount / capacity) * 100);
  const availableSlots = Math.max(0, capacity - registeredCount);

  const footerMessage =
    registeredCount >= capacity
      ? `Capacidad de manicuristas al máximo (${capacity} lugares cubiertos).`
      : availableSlots === 1
        ? `1 lugar disponible para cubrir de ${capacity} en el salón.`
        : `${availableSlots} lugares disponibles para cubrir de ${capacity} en el salón.`;

  return (
    <div className="bg-surface-container-lowest p-6 rounded-2xl border border-primary/5 luxury-shadow h-full flex items-start justify-between">
      <div className="space-y-3 min-w-0 flex-1">
        <span className="text-[10px] text-outline font-bold tracking-widest uppercase block">
          Ocupación Cabinas
        </span>

        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-display text-4xl font-extrabold text-primary">
            {registeredCount}/{capacity}
          </span>
          <span className="text-sky-700 text-xs font-bold font-sans">
            {occupancyPercent}% ocupación
          </span>
        </div>

        <p className="text-xs text-on-surface-variant">{footerMessage}</p>
      </div>

      <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
        <Clock className="w-6 h-6 text-secondary" />
      </div>
    </div>
  );
}
