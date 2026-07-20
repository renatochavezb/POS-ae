"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Camera, Loader2, Plus, Send, Trash2, X } from "lucide-react";
import { Appointment, CashTicketLine, Service } from "../types";
import { formatMXN, formatServicePrice } from "../data";
import { splitAppointmentServices } from "../serviceDisplay";
import posApi from "@/libs/posApi";
import {
  formatPerNailLabel,
  resolveServiceLinePrice,
} from "@/libs/posPriceList";

type TicketLine = CashTicketLine & {
  key: string;
  quantity?: number;
  nailScope?: "manos" | "manos_pies" | "";
};

type PhotoDraft = {
  id: string;
  file: File;
  previewUrl: string;
};

const MAX_WORK_PHOTOS = 3;

async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxWidth = 1400;
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8)
    );
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

const createLineKey = () => `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const createPhotoId = () => `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

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
        quantity: 1,
        nailScope: "",
      },
    ];
  }

  return names.map((name) => {
    const catalog = findCatalogByName(services, name);
    const isPerNail = catalog?.pricingMode === "per_nail";
    const quantity = isPerNail ? 10 : 1;
    const unitPrice = catalog?.price ?? 0;
    const fallbackPrice =
      names.length === 1 && appointment.cost > 0 ? appointment.cost : unitPrice;

    return {
      key: createLineKey(),
      serviceId: catalog?.id || "",
      name: catalog?.name || name,
      price: isPerNail
        ? resolveServiceLinePrice(catalog, quantity)
        : unitPrice > 0
          ? unitPrice
          : fallbackPrice,
      quantity,
      nailScope: isPerNail ? "manos" : "",
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
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  const subtotal = lines.reduce((sum, line) => sum + (Number(line.price) || 0), 0);

  const updateLine = (key: string, patch: Partial<TicketLine>) => {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  };

  const applyPerNail = (
    key: string,
    catalog: Service,
    quantity: number,
    scope: TicketLine["nailScope"]
  ) => {
    const max = catalog.nailMax || 20;
    const qty = Math.max(1, Math.min(quantity, max));
    updateLine(key, {
      serviceId: catalog.id,
      name: formatPerNailLabel(catalog.name, qty, scope || ""),
      quantity: qty,
      nailScope: scope || "",
      price: resolveServiceLinePrice(catalog, qty),
    });
  };

  const handleServicePick = (key: string, serviceId: string) => {
    const catalog = services.find((service) => service.id === serviceId);
    if (!catalog) {
      updateLine(key, { serviceId: "", quantity: 1, nailScope: "" });
      return;
    }

    if (catalog.pricingMode === "per_nail") {
      applyPerNail(key, catalog, 10, "manos");
      return;
    }

    updateLine(key, {
      serviceId: catalog.id,
      name: catalog.name,
      price: catalog.price > 0 ? catalog.price : 0,
      quantity: 1,
      nailScope: "",
    });
  };

  const addLine = () => {
    const defaultService = staffServices[0];
    const isPerNail = defaultService?.pricingMode === "per_nail";
    const quantity = isPerNail ? 10 : 1;
    setLines((prev) => [
      ...prev,
      {
        key: createLineKey(),
        serviceId: defaultService?.id || "",
        name: defaultService
          ? isPerNail
            ? formatPerNailLabel(defaultService.name, quantity, "manos")
            : defaultService.name
          : "",
        price: defaultService ? resolveServiceLinePrice(defaultService, quantity) : 0,
        quantity,
        nailScope: isPerNail ? "manos" : "",
      },
    ]);
  };

  const removeLine = (key: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
  };

  const handlePhotoPick = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";

    if (picked.length === 0) return;

    setPhotos((prev) => {
      const remaining = MAX_WORK_PHOTOS - prev.length;
      if (remaining <= 0) return prev;

      const next = picked.slice(0, remaining).map((file) => ({
        id: createPhotoId(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      return [...prev, ...next];
    });
    if (error) setError(null);
  };

  const removePhoto = (photoId: string) => {
    setPhotos((prev) => {
      const target = prev.find((photo) => photo.id === photoId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((photo) => photo.id !== photoId);
    });
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

    if (photos.length === 0) {
      setError("Agrega al menos una foto del trabajo.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const compressedFiles = await Promise.all(
        photos.map((photo) => compressImageForUpload(photo.file))
      );
      const { photos: workPhotos } = await posApi.uploadCashTicketWorkPhotos(
        appointment.id,
        compressedFiles
      );

      await posApi.submitCashTicket({
        appointmentId: appointment.id,
        lines: payloadLines,
        workPhotos,
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
            Arma la ficha: servicios, precios y fotos. Puedes ajustar cualquier precio. Los de
            «por uña» se multiplican (manos ×10 o manos y pies ×20).
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                Fotos del trabajo
              </p>
              <span className="text-[10px] text-outline">
                {photos.length}/{MAX_WORK_PHOTOS} · mínimo 1
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square rounded-xl overflow-hidden border border-primary/10 bg-surface-container-low"
                >
                  <img
                    src={photo.previewUrl}
                    alt="Foto del trabajo"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    title="Quitar foto"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {photos.length < MAX_WORK_PHOTOS && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="aspect-square rounded-xl border border-dashed border-primary/20 bg-surface-container-low/50 flex flex-col items-center justify-center gap-1 text-outline hover:border-secondary hover:text-secondary transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Agregar</span>
                </button>
              )}
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              multiple
              className="hidden"
              onChange={handlePhotoPick}
            />
          </div>

          <div className="space-y-3">
            {lines.map((line) => {
              const catalog = services.find((s) => s.id === line.serviceId);
              const isPerNail = catalog?.pricingMode === "per_nail";
              const nailMax = catalog?.nailMax || 20;

              return (
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
                          {service.price > 0
                            ? ` — ${formatServicePrice(service.price)}${
                                service.pricingMode === "per_nail" ? "/uña" : ""
                              }`
                            : ""}
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

                  {isPerNail && catalog && (
                    <div className="space-y-2 rounded-lg bg-surface p-2 border border-primary/5">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => applyPerNail(line.key, catalog, 10, "manos")}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                            line.nailScope === "manos"
                              ? "bg-primary text-on-primary border-primary"
                              : "border-primary/10 text-outline"
                          }`}
                        >
                          Solo manos (×10)
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPerNail(line.key, catalog, 20, "manos_pies")}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                            line.nailScope === "manos_pies"
                              ? "bg-primary text-on-primary border-primary"
                              : "border-primary/10 text-outline"
                          }`}
                        >
                          Manos y pies (×20)
                        </button>
                      </div>
                      <label className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-outline shrink-0">
                          Uñas
                        </span>
                        <select
                          value={line.quantity || 1}
                          onChange={(e) =>
                            applyPerNail(
                              line.key,
                              catalog,
                              Number(e.target.value),
                              line.nailScope || ""
                            )
                          }
                          className="flex-1 px-2 py-1.5 rounded-lg border border-primary/10 bg-surface text-xs font-bold text-primary"
                        >
                          {Array.from({ length: nailMax }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              × {n} ({formatMXN(resolveServiceLinePrice(catalog, n))})
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="text-[10px] text-outline">
                        Unitario {formatMXN(catalog.price)} · total editable abajo
                      </p>
                    </div>
                  )}

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
              );
            })}
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
            disabled={isSubmitting || subtotal <= 0 || photos.length === 0}
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
