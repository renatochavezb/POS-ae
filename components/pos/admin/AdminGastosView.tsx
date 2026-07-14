"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Loader2 } from "lucide-react";
import posApi from "@/libs/posApi";
import { Expense, ExpenseCategory, Supplier } from "../types";
import { formatMXN } from "../data";
import AdminPageShell from "./AdminPageShell";

type AdminGastosViewProps = {
  isAccountantSession: boolean;
  isMasterSession: boolean;
};

export default function AdminGastosView({
  isAccountantSession,
  isMasterSession,
}: AdminGastosViewProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    categoryCode: "",
    description: "",
    amount: "",
    paymentMethod: "efectivo",
    supplierCode: "",
    receiptReference: "",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [expenseRows, categoryRows, supplierRows] = await Promise.all([
        posApi.getExpenses(),
        posApi.getExpenseCategories(),
        posApi.getSuppliers(),
      ]);
      setExpenses(expenseRows);
      setCategories(categoryRows);
      setSuppliers(supplierRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los gastos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const availableCategories = useMemo(() => {
    return categories.filter((category) => {
      if (isMasterSession) return true;
      if (isAccountantSession) {
        return category.allowedRoles === "accountant" || category.allowedRoles === "both";
      }
      return category.allowedRoles === "reception" || category.allowedRoles === "both";
    });
  }, [categories, isAccountantSession, isMasterSession]);

  const totalMonth = useMemo(
    () => expenses.filter((e) => e.status !== "cancelado").reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const supplier = suppliers.find((row) => row.id === form.supplierCode);
      const created = await posApi.createExpense({
        categoryCode: form.categoryCode,
        description: form.description.trim(),
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod as Expense["paymentMethod"],
        supplierCode: supplier?.id || "",
        supplierName: supplier?.name || "",
        receiptReference: form.receiptReference.trim(),
        notes: form.notes.trim(),
      });
      setExpenses((prev) => [created, ...prev]);
      setForm({
        categoryCode: "",
        description: "",
        amount: "",
        paymentMethod: "efectivo",
        supplierCode: "",
        receiptReference: "",
        notes: "",
      });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el gasto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageShell
      eyebrow="Administración · Gastos"
      title="Control de Gastos"
      description={
        isAccountantSession
          ? "Registra servicios, renta, impuestos y obligaciones contables."
          : "Registra insumos, caja chica y gastos operativos del salón."
      }
      action={
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-all shadow-sm"
        >
          <Plus className="w-4 h-4 text-secondary" />
          <span>Nuevo gasto</span>
        </button>
      }
    >
      {error ? (
        <div className="rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-primary/5 bg-surface-container-lowest p-5">
          <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Total registrado</p>
          <p className="font-display text-2xl font-bold text-primary mt-2">{formatMXN(totalMonth)}</p>
        </div>
        <div className="rounded-2xl border border-primary/5 bg-surface-container-lowest p-5">
          <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Movimientos</p>
          <p className="font-display text-2xl font-bold text-primary mt-2">{expenses.length}</p>
        </div>
        <div className="rounded-2xl border border-primary/5 bg-surface-container-lowest p-5">
          <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Categorías disponibles</p>
          <p className="font-display text-2xl font-bold text-primary mt-2">{availableCategories.length}</p>
        </div>
      </div>

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-primary/10 bg-surface-container-lowest p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 text-sm">
              <span className="font-bold text-primary">Categoría</span>
              <select
                required
                value={form.categoryCode}
                onChange={(e) => setForm((prev) => ({ ...prev, categoryCode: e.target.value }))}
                className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
              >
                <option value="">Selecciona categoría</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-bold text-primary">Monto (MXN)</span>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-bold text-primary">Descripción</span>
              <input
                required
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
                placeholder="Ej. Compra de esmaltes, pago de luz..."
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-bold text-primary">Método de pago</span>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="gift_card">Gift Card</option>
                <option value="cheque">Cheque</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-bold text-primary">Proveedor (opcional)</span>
              <select
                value={form.supplierCode}
                onChange={(e) => setForm((prev) => ({ ...prev, supplierCode: e.target.value }))}
                className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
              >
                <option value="">Sin proveedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-bold text-primary">Folio / factura</span>
              <input
                value={form.receiptReference}
                onChange={(e) => setForm((prev) => ({ ...prev, receiptReference: e.target.value }))}
                className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-bold text-primary">Notas</span>
              <input
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-on-secondary text-xs font-bold uppercase tracking-wider disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Guardar en MongoDB
          </button>
        </form>
      ) : null}

      <div className="rounded-2xl border border-primary/5 bg-surface-container-lowest overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-outline">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Cargando gastos...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-left text-[10px] uppercase tracking-widest text-outline">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Registró</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-t border-primary/5">
                    <td className="px-4 py-3">{expense.expenseDate}</td>
                    <td className="px-4 py-3">{expense.categoryName}</td>
                    <td className="px-4 py-3">{expense.description}</td>
                    <td className="px-4 py-3 font-bold text-primary">{formatMXN(expense.amount)}</td>
                    <td className="px-4 py-3 text-outline">{expense.recordedByName}</td>
                  </tr>
                ))}
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-outline">
                      Aún no hay gastos registrados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}
