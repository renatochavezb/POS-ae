"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Loader2, CheckCircle2 } from "lucide-react";
import posApi from "@/libs/posApi";
import { Payable, Supplier } from "../types";
import { formatMXN } from "../data";
import AdminPageShell from "./AdminPageShell";

export default function AdminCuentasPagarView() {
  const [payables, setPayables] = useState<Payable[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    supplierCode: "",
    concept: "",
    amount: "",
    dueDate: "",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [payableRows, supplierRows] = await Promise.all([
        posApi.getPayables(),
        posApi.getSuppliers(),
      ]);
      setPayables(payableRows);
      setSuppliers(supplierRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las cuentas por pagar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const pendingTotal = useMemo(
    () =>
      payables
        .filter((row) => row.status === "pendiente" || row.status === "vencida")
        .reduce((sum, row) => sum + row.amount, 0),
    [payables]
  );

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
      const created = await posApi.createPayable({
        supplierCode: supplier.id,
        supplierName: supplier.name,
        concept: form.concept.trim(),
        amount: Number(form.amount),
        dueDate: form.dueDate,
        notes: form.notes.trim(),
      });
      setPayables((prev) => [created, ...prev]);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la cuenta");
    } finally {
      setSaving(false);
    }
  };

  const markAsPaid = async (payable: Payable) => {
    setError("");
    try {
      const updated = await posApi.updatePayable(payable.id, {
        status: "pagada",
        paidAmount: payable.amount,
      });
      setPayables((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo marcar como pagada");
    }
  };

  return (
    <AdminPageShell
      eyebrow="Administración · Cuentas por pagar"
      title="Cuentas por Pagar"
      description="Obligaciones con proveedores. Módulo exclusivo de contabilidad y administrador."
      action={
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-all shadow-sm"
        >
          <Plus className="w-4 h-4 text-secondary" />
          <span>Nueva cuenta</span>
        </button>
      }
    >
      {error ? (
        <div className="rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-primary/5 bg-surface-container-lowest p-5 max-w-sm">
        <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Pendiente por pagar</p>
        <p className="font-display text-2xl font-bold text-primary mt-2">{formatMXN(pendingTotal)}</p>
      </div>

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
            <span className="font-bold text-primary">Concepto</span>
            <input required value={form.concept} onChange={(e) => setForm((p) => ({ ...p, concept: e.target.value }))} className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Monto</span>
            <input required type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Vencimiento</span>
            <input required type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface" />
          </label>
          <div className="md:col-span-2">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-on-secondary text-xs font-bold uppercase tracking-wider disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Guardar cuenta
            </button>
          </div>
        </form>
      ) : null}

      <div className="rounded-2xl border border-primary/5 bg-surface-container-lowest overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-outline">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Cargando cuentas...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-left text-[10px] uppercase tracking-widest text-outline">
                <tr>
                  <th className="px-4 py-3">Folio</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Concepto</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Vence</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {payables.map((payable) => (
                  <tr key={payable.id} className="border-t border-primary/5">
                    <td className="px-4 py-3 font-mono text-xs">{payable.id}</td>
                    <td className="px-4 py-3">{payable.supplierName}</td>
                    <td className="px-4 py-3">{payable.concept}</td>
                    <td className="px-4 py-3 font-bold text-primary">{formatMXN(payable.amount)}</td>
                    <td className="px-4 py-3">{payable.dueDate}</td>
                    <td className="px-4 py-3 capitalize">{payable.status}</td>
                    <td className="px-4 py-3">
                      {payable.status === "pendiente" || payable.status === "vencida" ? (
                        <button
                          type="button"
                          onClick={() => markAsPaid(payable)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-primary/10 text-xs font-bold uppercase"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Pagar
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
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
