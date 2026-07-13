"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Loader2 } from "lucide-react";
import posApi from "@/libs/posApi";
import { Purchase, Supplier } from "../types";
import { formatMXN } from "../data";
import AdminPageShell from "./AdminPageShell";

export default function AdminComprasView() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    supplierCode: "",
    itemName: "",
    quantity: "1",
    unitCost: "0",
    tax: "0",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [purchaseRows, supplierRows] = await Promise.all([
        posApi.getPurchases(),
        posApi.getSuppliers(),
      ]);
      setPurchases(purchaseRows);
      setSuppliers(supplierRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las compras");
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

    const supplier = suppliers.find((row) => row.id === form.supplierCode);
    if (!supplier) {
      setError("Selecciona un proveedor");
      setSaving(false);
      return;
    }

    try {
      const created = await posApi.createPurchase({
        supplierCode: supplier.id,
        supplierName: supplier.name,
        tax: Number(form.tax),
        notes: form.notes.trim(),
        items: [
          {
            name: form.itemName.trim(),
            quantity: Number(form.quantity),
            unitCost: Number(form.unitCost),
          },
        ],
      });
      setPurchases((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({
        supplierCode: "",
        itemName: "",
        quantity: "1",
        unitCost: "0",
        tax: "0",
        notes: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la compra");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageShell
      eyebrow="Administración · Compras"
      title="Registro de Compras"
      description="Recepción registra compras operativas; contabilidad valida montos y actualiza inventario en MongoDB."
      action={
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-all shadow-sm"
        >
          <Plus className="w-4 h-4 text-secondary" />
          <span>Nueva compra</span>
        </button>
      }
    >
      {error ? (
        <div className="rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{error}</div>
      ) : null}

      {showForm ? (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-primary/10 bg-surface-container-lowest p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-bold text-primary">Proveedor</span>
            <select required value={form.supplierCode} onChange={(e) => setForm((p) => ({ ...p, supplierCode: e.target.value }))} className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface">
              <option value="">Selecciona proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-bold text-primary">Artículo / concepto</span>
            <input required value={form.itemName} onChange={(e) => setForm((p) => ({ ...p, itemName: e.target.value }))} className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Cantidad</span>
            <input required type="number" min="1" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Costo unitario</span>
            <input required type="number" min="0" step="0.01" value={form.unitCost} onChange={(e) => setForm((p) => ({ ...p, unitCost: e.target.value }))} className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">IVA / impuestos</span>
            <input type="number" min="0" step="0.01" value={form.tax} onChange={(e) => setForm((p) => ({ ...p, tax: e.target.value }))} className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface" />
          </label>
          <div className="md:col-span-2">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-on-secondary text-xs font-bold uppercase tracking-wider disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Registrar compra
            </button>
          </div>
        </form>
      ) : null}

      <div className="rounded-2xl border border-primary/5 bg-surface-container-lowest overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-outline">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Cargando compras...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-left text-[10px] uppercase tracking-widest text-outline">
                <tr>
                  <th className="px-4 py-3">Folio</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Pago</th>
                  <th className="px-4 py-3">Registró</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-t border-primary/5">
                    <td className="px-4 py-3 font-mono text-xs">{purchase.id}</td>
                    <td className="px-4 py-3">{purchase.purchaseDate}</td>
                    <td className="px-4 py-3">{purchase.supplierName}</td>
                    <td className="px-4 py-3 font-bold text-primary">{formatMXN(purchase.total)}</td>
                    <td className="px-4 py-3 capitalize">{purchase.paymentStatus}</td>
                    <td className="px-4 py-3 text-outline">{purchase.recordedByName}</td>
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
