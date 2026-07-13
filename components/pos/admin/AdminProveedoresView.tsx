"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Loader2 } from "lucide-react";
import posApi from "@/libs/posApi";
import { Supplier } from "../types";
import AdminPageShell from "./AdminPageShell";

export default function AdminProveedoresView() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    contactName: "",
    phone: "",
    email: "",
    taxId: "",
    category: "general",
    paymentTerms: "",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      setSuppliers(await posApi.getSuppliers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los proveedores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await posApi.createSupplier(form);
      setSuppliers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({
        name: "",
        contactName: "",
        phone: "",
        email: "",
        taxId: "",
        category: "general",
        paymentTerms: "",
        notes: "",
      });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el proveedor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageShell
      eyebrow="Administración · Proveedores"
      title="Directorio de Proveedores"
      description="Gestión de proveedores para compras, gastos y cuentas por pagar. Solo contabilidad y administrador."
      action={
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-all shadow-sm"
        >
          <Plus className="w-4 h-4 text-secondary" />
          <span>Nuevo proveedor</span>
        </button>
      }
    >
      {error ? (
        <div className="rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      {showForm ? (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-primary/10 bg-surface-container-lowest p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-bold text-primary">Nombre comercial</span>
            <input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Contacto</span>
            <input value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Teléfono</span>
            <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Correo</span>
            <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">RFC</span>
            <input value={form.taxId} onChange={(e) => setForm((p) => ({ ...p, taxId: e.target.value }))} className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Categoría</span>
            <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface">
              <option value="general">General</option>
              <option value="insumos">Insumos</option>
              <option value="servicios">Servicios</option>
              <option value="equipo">Equipo</option>
            </select>
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-bold text-primary">Condiciones de pago</span>
            <input value={form.paymentTerms} onChange={(e) => setForm((p) => ({ ...p, paymentTerms: e.target.value }))} className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface" placeholder="Ej. 15 días, contado..." />
          </label>
          <div className="md:col-span-2">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-on-secondary text-xs font-bold uppercase tracking-wider disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Guardar proveedor
            </button>
          </div>
        </form>
      ) : null}

      <div className="rounded-2xl border border-primary/5 bg-surface-container-lowest overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-outline">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Cargando proveedores...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-left text-[10px] uppercase tracking-widest text-outline">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Pago</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-t border-primary/5">
                    <td className="px-4 py-3 font-mono text-xs">{supplier.id}</td>
                    <td className="px-4 py-3 font-bold text-primary">{supplier.name}</td>
                    <td className="px-4 py-3">{supplier.contactName || "—"}</td>
                    <td className="px-4 py-3">{supplier.phone || "—"}</td>
                    <td className="px-4 py-3">{supplier.paymentTerms || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}
