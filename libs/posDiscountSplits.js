/**
 * Normaliza el reparto de descuento ( % del servicio → monto de comisión ).
 * El cliente recibe discount = suma de amounts; el estudio no absorbe la pérdida.
 */
export function normalizeDiscountSplits(serviceGross, splits = []) {
  const gross = Math.max(0, Number(serviceGross) || 0);
  const normalized = [];

  for (const raw of splits || []) {
    const role = raw?.role === "receptionist" ? "receptionist" : "staff";
    const id = String(raw?.id || "").trim();
    const name = String(raw?.name || "").trim() || id;
    const percent = Math.max(0, Number(raw?.percent) || 0);
    if (!id || percent <= 0) continue;
    const amount = Math.round(((gross * percent) / 100) * 100) / 100;
    normalized.push({ role, id, name, percent, amount });
  }

  const totalPercent = normalized.reduce((sum, row) => sum + row.percent, 0);
  if (totalPercent > 100.009) {
    throw new Error("La suma de porcentajes del descuento no puede superar 100%.");
  }

  const discount = Math.round(normalized.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;

  return {
    discountSplits: normalized,
    discount,
    totalPercent,
    primary: normalized[0] || null,
  };
}
