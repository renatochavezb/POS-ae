"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Send, Trash2, X } from "lucide-react";
import { Appointment, CashTicketLine, Service } from "../types";
import { formatMXN } from "../data";
import { splitAppointmentServices } from "../serviceDisplay";
import posApi from "@/libs/posApi";

type TicketLine = CashTicketLine & { key: string };

const createLineKey = () => `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

function findCatalogByName(services: Service[], name: string) {
  const normalized = name.trim().toLowerCase();
  return (
    services.find((service) => service.name.toLowerCase() === normalized) ||
    services.find(
      (service) =>
        normalized.includes(service.name.toLowerCase()) ||
        service.name.toLowerCase().includes(normalized)
    )
  );
}

function buildInitialLines(appointment: Appointment, services: Service[]): TicketLine[] {
  const names = splitAppointmentServices(appointment.serviceName);

  if (names.length === 0) {
    return [
      {
        key: createLineKey(),
        serviceId: "",
        name: appointment.serviceName || "",
        price: appointment.cost || 0,
      },
    ];
  }

  return names.map((name) => {
    const catalog = findCatalogByName(services, name);
    const fallbackPrice =
      names.length === 1 && appointment.cost > 0 ? appointment.cost : catalog?.price ?? 0;

    return {
      key: createLineKey(),
      serviceId: catalog?.id || "",
      name: catalog?.name || name,
      price: catalog?.price && catalog.price > 0 ? catalog.price : fallbackPrice,
    };
  });
}

interface SendToCajaModalProps {
  appointment: Appointment;
  services: Service[];
  staffName: string;
  onClose: () => void;
  onSubmitted: () => void | Promise<void>;
}

export default function SendToCajaModal({
  appointment,
  services,
  staffName,
  onClose,
  onSubmitted,
}: SendToCajaModalProps) {
  const staffServices = useMemo(
    () =>
      services.filter(
        (service) =>
          service.staffIds.length === 0 || service.staffIds.includes(appointment.staffId)
      ),
    [services, appointment.staffId]
  );

  const [lines, setLines] = useState<TicketLine[]>(() =>
    buildInitialLines(appointment, services)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = lines.reduce((sum, line) => sum + (Number(line.price) || 0), 0);

  const updateLine = (key: string, patch: Partial<TicketLine>) => {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  };

  const handleServicePick = (key: string, serviceId: string) => {
    const catalog = services.find((service) => service.id === serviceId);
    if (!catalog) return;
    updateLine(key, {
      serviceId: catalog.id,
      name: catalog.name,
      price: catalog.price > 0 ? catalog.price : 0,
    });
  };

  const addLine = () => {
    const defaultService = staffServices[0];
    setLines((prev) => [
      ...prev,
      {
        key: createLineKey(),
        serviceId: defaultService?.id || "",
        name: defaultService?.name || "",
        price: defaultService?.price || 0,
      },
    ]);
  };

  const removeLine = (key: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
  };

  const handleSubmit = async () => {
    const payloadLines = lines
      .map(({ serviceId, name, price }) => ({
        serviceId,
        name: name.trim(),
        price: Number(price) || 0,
      }))
      .filter((line) => line.name.length > 0);

    if (payloadLines.length === 0) {
      setError("Agrega al menos un servicio.");
      return;
    }

    if (payloadLines.some((line) => line.price <= 0)) {
      setError("Cada servicio necesita un precio mayor a cero.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await posApi.submitCashTicket({
        appointmentId: appointment.id,
        lines: payloadLines,
        submittedByStaffId: appointment.staffId,
        submittedByStaffName: staffName,
      });
      await onSubmitted();
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "No se pudo enviar a caja"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-surface-container-lowest w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-primary/10 luxury-shadow overflow-hidden max-h-[92dvh] flex flex-col">
        <div className="px-5 py-4 border-b border-primary/5 bg-surface-container-low/40 flex items-start justify-between gap-3">
          <div>
            <span className="text-secondary font-sans text-[10px] font-extrabold uppercase tracking-widest block">
              Enviar a caja
            </span>
            <h3 className="font-display text-xl font-bold text-primary">{appointment.clientName}</h3>
            <p className="text-xs text-outline mt-0.5">{staffName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-outline hover:text-primary transition-colors shrink-0"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs text-outline">
            Arma la ficha como en el grupo de WhatsApp: servicios y precios. La recepción la cobra
            en caja.
          </p>

          <div className="space-y-3">
            {lines.map((line) => (
              <div
                key={line.key}
                className="rounded-xl border border-primary/10 bg-surface-container-low/50 p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <select
                    value={line.serviceId}
                    onChange={(e) => handleServicePick(line.key, e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-primary/10 bg-surface text-xs font-bold text-primary"
                  >
                    <option value="">Otro servicio…</option>
                    {staffServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="p-2 rounded-lg text-outline hover:text-red-700 hover:bg-red-50 transition-colors"
                    title="Quitar línea"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  value={line.name}
                  onChange={(e) => updateLine(line.key, { name: e.target.value })}
                  placeholder="Nombre del servicio"
                  className="w-full px-3 py-2 rounded-lg border border-primary/10 bg-surface text-sm font-bold text-primary"
                />

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                    Precio
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={line.price || ""}
                    onChange={(e) =>
                      updateLine(line.key, { price: Number(e.target.value) || 0 })
                    }
                    className="flex-1 px-3 py-2 rounded-lg border border-primary/10 bg-surface text-sm font-bold text-primary text-right"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addLine}
            className="w-full py-2.5 rounded-xl border border-dashed border-primary/20 text-xs font-bold uppercase tracking-wider text-outline hover:border-secondary hover:text-secondary transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Agregar servicio
          </button>

          <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-outline">Total</span>
            <span className="font-display text-2xl font-bold text-primary">{formatMXN(subtotal)}</span>
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="p-5 border-t border-primary/5 bg-surface-container-low/30">
          <button
            type="button"
            disabled={isSubmitting || subtotal <= 0}
            onClick={handleSubmit}
            className="w-full py-3.5 rounded-xl bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Enviar a caja
          </button>
        </div>
      </div>
    </div>
  );
}
