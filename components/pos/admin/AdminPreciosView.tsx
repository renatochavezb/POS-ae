"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Loader2, Upload, Save, Tags } from "lucide-react";
import posApi from "@/libs/posApi";
import { Service } from "../types";
import { formatMXN, formatServicePrice } from "../data";
import AdminPageShell from "./AdminPageShell";

type DraftMap = Record<string, string>;

export default function AdminPreciosView() {
  const [services, setServices] = useState<Service[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "price_list" | "legacy">("all");
  const [selectedId, setSelectedId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const { services: rows } = await posApi.getAdminServices();
      setServices(rows);
      const nextDrafts: DraftMap = {};
      rows.forEach((row) => {
        nextDrafts[row.id] = String(row.price ?? 0);
      });
      setDrafts(nextDrafts);
      if (!selectedId && rows[0]) setSelectedId(rows[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la lista de precios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return services;
    return services.filter((s) => (s.source || "legacy") === filter);
  }, [services, filter]);

  const selected = services.find((s) => s.id === selectedId) || filtered[0];

  const handleSavePrice = async (service: Service) => {
    const price = Number(drafts[service.id]);
    if (!Number.isFinite(price) || price < 0) {
      setError("Precio inválido");
      return;
    }

    setSavingId(service.id);
    setError("");
    setMessage("");
    try {
      const { service: updated } = await posApi.updateAdminService({
        serviceCode: service.id,
        price,
      });
      setServices((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setDrafts((prev) => ({ ...prev, [updated.id]: String(updated.price) }));
      setMessage(`Precio actualizado: ${updated.name} → ${formatMXN(updated.price)}`);
      // Refrescar catálogo global en otras pantallas
      await posApi.getServices().catch(() => null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el precio");
    } finally {
      setSavingId("");
    }
  };

  const handleToggleMode = async (service: Service) => {
    const nextMode = service.pricingMode === "per_nail" ? "fixed" : "per_nail";
    setSavingId(service.id);
    setError("");
    try {
      const { service: updated } = await posApi.updateAdminService({
        serviceCode: service.id,
        pricingMode: nextMode,
        nailMax: nextMode === "per_nail" ? 20 : 1,
      });
      setServices((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setMessage(
        nextMode === "per_nail"
          ? `${updated.name}: ahora es precio por uña`
          : `${updated.name}: ahora es precio fijo`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el modo");
    } finally {
      setSavingId("");
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setError("");
    setMessage("");
    try {
      const result = await posApi.importAdminServicesExcel(file);
      setMessage(
        `Excel importado: ${result.updated} actualizados, ${result.created} nuevos (${result.total} filas).`
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar el Excel");
    } finally {
      setImporting(false);
    }
  };

  const handleQuickSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    await handleSavePrice(selected);
  };

  return (
    <AdminPageShell
      eyebrow="Administración · Solo master"
      title="Lista de precios"
      description="Precios oficiales ligados a Mongo. La lista de Servicios ae va primero; el catálogo anterior se conserva."
      action={
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40"
        >
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Importar Excel
        </button>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleImport}
      />

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Todos"],
            ["price_list", "Lista oficial"],
            ["legacy", "Catálogo previo"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors ${
              filter === id
                ? "bg-primary text-on-primary border-primary"
                : "border-primary/10 text-outline hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-outline py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Cargando precios…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Modo 1: lista desplegable + editar */}
          <form
            onSubmit={handleQuickSave}
            className="lg:col-span-2 space-y-4 rounded-2xl border border-primary/10 bg-surface-container-low/40 p-5"
          >
            <div className="flex items-center gap-2 text-primary">
              <Tags className="w-4 h-4" />
              <h3 className="font-display text-lg font-bold">Editar precio</h3>
            </div>
            <p className="text-xs text-outline">
              Elige un servicio del desplegable y cambia su precio. Los de «por uña» se multiplican
              al cobrar (1–20).
            </p>

            <label className="block space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                Servicio
              </span>
              <select
                value={selected?.id || ""}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-primary/10 bg-surface text-sm font-bold text-primary"
              >
                {filtered.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} — {formatServicePrice(service.price)}
                    {service.pricingMode === "per_nail" ? " / uña" : ""}
                  </option>
                ))}
              </select>
            </label>

            {selected && (
              <>
                <div className="text-[11px] text-outline space-y-1">
                  <p>
                    Categoría: <span className="font-bold text-primary">{selected.category}</span>
                  </p>
                  <p>
                    Origen:{" "}
                    <span className="font-bold text-primary">
                      {selected.source === "price_list" ? "Lista oficial" : "Catálogo previo"}
                    </span>
                  </p>
                  <p>
                    Modo:{" "}
                    <span className="font-bold text-primary">
                      {selected.pricingMode === "per_nail" ? "Por uña" : "Precio fijo"}
                    </span>
                  </p>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                    {selected.pricingMode === "per_nail" ? "Precio por uña (MXN)" : "Precio (MXN)"}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={drafts[selected.id] ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [selected.id]: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-primary/10 bg-surface text-lg font-bold text-primary"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={savingId === selected.id}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-on-secondary text-xs font-bold uppercase tracking-wider disabled:opacity-40"
                  >
                    {savingId === selected.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Guardar precio
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleMode(selected)}
                    disabled={savingId === selected.id}
                    className="px-4 py-2.5 rounded-xl border border-primary/15 text-xs font-bold uppercase tracking-wider text-primary hover:bg-surface disabled:opacity-40"
                  >
                    {selected.pricingMode === "per_nail" ? "Pasar a fijo" : "Marcar por uña"}
                  </button>
                </div>
              </>
            )}
          </form>

          {/* Tabla completa */}
          <div className="lg:col-span-3 rounded-2xl border border-primary/10 overflow-hidden bg-surface">
            <div className="px-4 py-3 border-b border-primary/5 bg-surface-container-low/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                {filtered.length} servicios · lista oficial primero
              </p>
            </div>
            <div className="max-h-[28rem] overflow-y-auto divide-y divide-primary/5">
              {filtered.map((service) => {
                const dirty = drafts[service.id] !== String(service.price ?? 0);
                return (
                  <div
                    key={service.id}
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                      selected?.id === service.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(service.id)}
                      className="flex-1 min-w-[10rem] text-left"
                    >
                      <p className="text-sm font-bold text-primary">{service.name}</p>
                      <p className="text-[10px] text-outline">
                        {service.category}
                        {service.pricingMode === "per_nail" ? " · por uña" : ""}
                        {service.source === "price_list" ? " · oficial" : " · previo"}
                      </p>
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={drafts[service.id] ?? ""}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [service.id]: e.target.value }))
                      }
                      onFocus={() => setSelectedId(service.id)}
                      className="w-24 px-2 py-1.5 rounded-lg border border-primary/10 bg-surface text-sm font-bold text-primary text-right"
                    />
                    <button
                      type="button"
                      disabled={!dirty || savingId === service.id}
                      onClick={() => handleSavePrice(service)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-primary text-on-primary disabled:opacity-30"
                    >
                      {savingId === service.id ? "…" : "OK"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-outline">
        Importar Excel: columnas <strong>Nombre</strong> y <strong>Precio</strong> (o A/B). Actualiza
        precios existentes por nombre; no borra servicios ya dados de alta.
      </p>
    </AdminPageShell>
  );
}
