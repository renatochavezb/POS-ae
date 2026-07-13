"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Plus,
  Loader2,
  AlertTriangle,
  Package,
  Search,
  Droplets,
  Sparkles,
  Layers,
  Wrench,
  Minus,
} from "lucide-react";
import posApi from "@/libs/posApi";
import {
  INVENTORY_SYSTEMS,
  INVENTORY_UNITS,
  getInventorySystemLabel,
} from "@/libs/inventoryCategories";
import { InventoryCategory, InventoryItem, Supplier } from "../types";
import { formatMXN } from "../data";

const CATEGORY_ICONS: Record<string, typeof Package> = {
  preparacion: Droplets,
  bases: Layers,
  geles: Sparkles,
  efectos: Sparkles,
  "top-coat": Layers,
  semipermanente: Sparkles,
  acrilico: Package,
  monomero: Droplets,
  acrygel: Package,
  consumibles: Package,
  herramientas: Wrench,
  acabados: Droplets,
};

const EMPTY_FORM = {
  name: "",
  category: "bases",
  system: "gel",
  brand: "",
  shade: "",
  unit: "ml",
  currentStock: "0",
  minStock: "0",
  unitCost: "0",
  supplierCode: "",
  notes: "",
};

export default function InventarioView() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
  });

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [inventoryRows, categoryRows, supplierRows] = await Promise.all([
        posApi.getInventoryItems(),
        posApi.getInventoryCategories(),
        posApi.getSuppliers(),
      ]);
      setItems(inventoryRows);
      setCategories(categoryRows);
      setSuppliers(supplierRows);
      setForm((current) => ({
        ...current,
        category: categoryRows.some((row) => row.id === current.category)
          ? current.category
          : categoryRows[0]?.id || "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el inventario");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const lowStockItems = useMemo(
    () => items.filter((item) => item.currentStock <= item.minStock),
    [items]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.brand.toLowerCase().includes(query) ||
        item.shade.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [items, search, selectedCategory]);

  const groupedItems = useMemo(() => {
    if (selectedCategory !== "all") return null;
    const groups = new Map<string, InventoryItem[]>();
    for (const item of filteredItems) {
      const key = item.category || "consumibles";
      const list = groups.get(key) || [];
      list.push(item);
      groups.set(key, list);
    }
    return categories.filter((cat) => groups.has(cat.id)).map((cat) => ({
      category: cat,
      items: groups.get(cat.id) || [],
    }));
  }, [categories, filteredItems, selectedCategory]);

  const getCategoryLabel = (categoryId: string) =>
    categories.find((row) => row.id === categoryId)?.label || categoryId;

  const stats = useMemo(() => {
    const totalValue = items.reduce(
      (sum, item) => sum + item.currentStock * item.unitCost,
      0
    );
    return {
      total: items.length,
      lowStock: lowStockItems.length,
      totalValue,
    };
  }, [items, lowStockItems]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const supplier = suppliers.find((row) => row.id === form.supplierCode);
      const created = await posApi.createInventoryItem({
        name: form.name.trim(),
        category: form.category,
        system: form.system,
        brand: form.brand.trim(),
        shade: form.shade.trim(),
        unit: form.unit,
        currentStock: Number(form.currentStock),
        minStock: Number(form.minStock),
        unitCost: Number(form.unitCost),
        supplierCode: supplier?.id || "",
        supplierName: supplier?.name || "",
        notes: form.notes.trim(),
      });
      setItems((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el artículo");
    } finally {
      setSaving(false);
    }
  };

  const handleCategorySubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSavingCategory(true);
    setError("");
    try {
      const created = await posApi.createInventoryCategory({
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
      });
      setCategories((prev) => [...prev, created]);
      setSelectedCategory(created.id);
      setForm((prev) => ({ ...prev, category: created.id }));
      setCategoryForm({ name: "", description: "" });
      setShowCategoryForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la sección");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleAdjustStock = async (item: InventoryItem, adjustment: number) => {
    setError("");
    try {
      const updated = await posApi.adjustInventoryStock(item.id, adjustment);
      setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ajustar el stock");
    }
  };

  const renderItemRow = (item: InventoryItem) => {
    const isLow = item.currentStock <= item.minStock;
    return (
      <tr key={item.id} className="border-t border-primary/5 hover:bg-surface-container-low/40">
        <td className="px-4 py-3">
          <p className="font-bold text-primary">{item.name}</p>
          <p className="text-xs text-outline mt-0.5">
            {item.id}
            {item.brand ? ` · ${item.brand}` : ""}
            {item.shade ? ` · ${item.shade}` : ""}
          </p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/5 text-primary">
              {getCategoryLabel(item.category)}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">
              {getInventorySystemLabel(item.system)}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={isLow ? "text-error font-bold" : "text-primary font-bold"}>
            {item.currentStock}
          </span>
          <span className="text-outline text-xs ml-1">{item.unit}</span>
        </td>
        <td className="px-4 py-3 text-outline">{item.minStock}</td>
        <td className="px-4 py-3">{formatMXN(item.unitCost)}</td>
        <td className="px-4 py-3">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => handleAdjustStock(item, 1)}
              className="w-7 h-7 rounded-lg border border-primary/10 text-xs font-bold hover:bg-primary/5 flex items-center justify-center"
              title="Agregar 1"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => handleAdjustStock(item, -1)}
              disabled={item.currentStock <= 0}
              className="w-7 h-7 rounded-lg border border-primary/10 text-xs font-bold hover:bg-primary/5 flex items-center justify-center disabled:opacity-40"
              title="Restar 1"
            >
              <Minus className="w-3 h-3" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in p-1 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <span className="text-secondary font-sans text-xs font-bold tracking-widest uppercase">
            Control de Insumos
          </span>
          <h2 className="font-display text-3xl font-bold text-primary mt-1">
            Inventario de Manicura
          </h2>
          <p className="text-on-surface-variant text-sm mt-1 max-w-2xl">
            Geles, bases, efectos, monómeros, acrílico, acrygel, semipermanente,
            consumibles y herramientas para el servicio de uñas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCategoryForm((prev) => !prev)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary/15 bg-surface-container-lowest text-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-surface-container-low transition-all shrink-0"
          >
            <Layers className="w-4 h-4 text-secondary" />
            <span>Nueva sección</span>
          </button>
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            disabled={categories.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-all shadow-sm shrink-0 disabled:opacity-50"
          >
            <Plus className="w-4 h-4 text-secondary" />
            <span>Nuevo producto</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-primary/5 bg-surface-container-lowest p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Artículos</p>
          <p className="text-2xl font-bold text-primary mt-1">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-primary/5 bg-surface-container-lowest p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Stock bajo</p>
          <p className={`text-2xl font-bold mt-1 ${stats.lowStock > 0 ? "text-error" : "text-primary"}`}>
            {stats.lowStock}
          </p>
        </div>
        <div className="rounded-2xl border border-primary/5 bg-surface-container-lowest p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Valor en stock</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatMXN(stats.totalValue)}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      {lowStockItems.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>{lowStockItems.length} artículo(s)</strong> en mínimo o por debajo:{" "}
            {lowStockItems.slice(0, 5).map((item) => item.name).join(", ")}
            {lowStockItems.length > 5 ? ` y ${lowStockItems.length - 5} más` : ""}
          </span>
        </div>
      ) : null}

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, marca, tono o código..."
            className="w-full rounded-xl border border-primary/10 pl-10 pr-4 py-2.5 bg-surface text-sm"
          />
        </div>
        <div className="p-1 bg-surface-container-lowest rounded-xl border border-primary/5 flex items-center gap-1 overflow-x-auto scrollbar-hide">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-2 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
              selectedCategory === "all"
                ? "bg-primary text-on-primary"
                : "text-outline hover:text-primary hover:bg-surface-container-low"
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-2 rounded-lg text-[10px] font-sans font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? "bg-primary text-on-primary"
                  : "text-outline hover:text-primary hover:bg-surface-container-low"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {selectedCategory !== "all" ? (
        <p className="text-sm text-outline">
          {categories.find((c) => c.id === selectedCategory)?.description}
        </p>
      ) : null}

      {showCategoryForm ? (
        <form
          onSubmit={handleCategorySubmit}
          className="rounded-2xl border border-secondary/20 bg-secondary/5 p-6 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="md:col-span-3">
            <p className="font-bold text-primary">Crear sección de inventario</p>
            <p className="text-xs text-outline mt-1">
              La sección se guardará en MongoDB y quedará disponible para todos los productos.
            </p>
          </div>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Nombre</span>
            <input
              required
              value={categoryForm.name}
              onChange={(e) =>
                setCategoryForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Ej. Decoración 3D"
              className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-bold text-primary">Descripción</span>
            <input
              value={categoryForm.description}
              onChange={(e) =>
                setCategoryForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Describe los productos que pertenecen a esta sección"
              className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
            />
          </label>
          <div className="md:col-span-3 flex gap-3">
            <button
              type="submit"
              disabled={savingCategory}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-on-secondary text-xs font-bold uppercase tracking-wider disabled:opacity-60"
            >
              {savingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Guardar sección
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCategoryForm(false);
                setCategoryForm({ name: "", description: "" });
              }}
              className="px-4 py-2 rounded-lg border border-primary/10 text-xs font-bold uppercase tracking-wider text-outline"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-primary/10 bg-surface-container-lowest p-6 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-bold text-primary">Nombre del producto</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ej. Rubber Base Clear 12ml"
              className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Categoría</span>
            <select
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Sistema</span>
            <select
              value={form.system}
              onChange={(e) => setForm((p) => ({ ...p, system: e.target.value }))}
              className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
            >
              {INVENTORY_SYSTEMS.map((sys) => (
                <option key={sys.id} value={sys.id}>
                  {sys.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Marca</span>
            <input
              value={form.brand}
              onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
              placeholder="Ej. Studio Pro"
              className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Tono / Variante</span>
            <input
              value={form.shade}
              onChange={(e) => setForm((p) => ({ ...p, shade: e.target.value }))}
              placeholder="Ej. Nude, Clear, #42"
              className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Unidad</span>
            <select
              value={form.unit}
              onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
              className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
            >
              {INVENTORY_UNITS.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Stock actual</span>
            <input
              type="number"
              min="0"
              value={form.currentStock}
              onChange={(e) => setForm((p) => ({ ...p, currentStock: e.target.value }))}
              className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Stock mínimo</span>
            <input
              type="number"
              min="0"
              value={form.minStock}
              onChange={(e) => setForm((p) => ({ ...p, minStock: e.target.value }))}
              className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold text-primary">Costo unitario</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.unitCost}
              onChange={(e) => setForm((p) => ({ ...p, unitCost: e.target.value }))}
              className="w-full rounded-lg border border-primary/10 px-3 py-2 bg-surface"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-3">
            <span className="font-bold text-primary">Proveedor</span>
            <select
              value={form.supplierCode}
              onChange={(e) => setForm((p) => ({ ...p, supplierCode: e.target.value }))}
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
          <div className="md:col-span-3 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-on-secondary text-xs font-bold uppercase tracking-wider disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Guardar artículo
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY_FORM);
              }}
              className="px-4 py-2 rounded-lg border border-primary/10 text-xs font-bold uppercase tracking-wider text-outline"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="p-12 flex items-center justify-center text-outline rounded-2xl border border-primary/5 bg-surface-container-lowest">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Cargando inventario...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-primary/5 bg-surface-container-lowest">
          <Package className="w-10 h-10 text-outline mx-auto mb-3 opacity-50" />
          <p className="text-primary font-bold">Sin artículos en esta categoría</p>
          <p className="text-sm text-outline mt-1">
            Agrega productos o cambia el filtro de búsqueda.
          </p>
        </div>
      ) : groupedItems ? (
        <div className="space-y-8">
          {groupedItems.map(({ category, items: groupItems }) => {
            const Icon = CATEGORY_ICONS[category.id] || Package;
            return (
              <section key={category.id}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-primary">{category.label}</h3>
                    <p className="text-xs text-outline">{groupItems.length} artículo(s)</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-primary/5 bg-surface-container-lowest overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-container-low text-left text-[10px] uppercase tracking-widest text-outline">
                        <tr>
                          <th className="px-4 py-3">Artículo</th>
                          <th className="px-4 py-3">Stock</th>
                          <th className="px-4 py-3">Mínimo</th>
                          <th className="px-4 py-3">Costo</th>
                          <th className="px-4 py-3">Ajuste</th>
                        </tr>
                      </thead>
                      <tbody>{groupItems.map(renderItemRow)}</tbody>
                    </table>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-primary/5 bg-surface-container-lowest overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-left text-[10px] uppercase tracking-widest text-outline">
                <tr>
                  <th className="px-4 py-3">Artículo</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Mínimo</th>
                  <th className="px-4 py-3">Costo</th>
                  <th className="px-4 py-3">Ajuste</th>
                </tr>
              </thead>
              <tbody>{filteredItems.map(renderItemRow)}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
