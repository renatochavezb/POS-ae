/**
 * Lectura de descuentos de comisión desde pagos (splits o legacy).
 * El estudio no absorbe: cada fila es un cargo a la nómina/comisión de esa persona.
 */

export function listDiscountRowsFromPayment(payment) {
  if (!payment) return [];

  const base = {
    reason: String(payment.discountReason || "").trim(),
    paymentId: payment.id || payment.paymentCode || "",
    appointmentId: payment.appointmentId || payment.appointmentCode || "",
    appointmentDate: payment.appointmentDate || "",
    clientName: payment.clientName || "",
    serviceName: payment.serviceName || "",
    serviceStaffName: payment.staffName || "",
    isWarranty: Boolean(payment.isWarranty),
  };

  const splits = Array.isArray(payment.discountSplits) ? payment.discountSplits : [];
  if (splits.length > 0) {
    return splits
      .map((split) => ({
        ...base,
        role: split?.role === "receptionist" ? "receptionist" : "staff",
        id: String(split?.id || "").trim(),
        name: String(split?.name || "").trim() || String(split?.id || "").trim(),
        percent: Number(split?.percent) || 0,
        amount: Math.round((Number(split?.amount) || 0) * 100) / 100,
      }))
      .filter((row) => row.id && row.amount > 0);
  }

  const amount = Math.round((Number(payment.discount) || 0) * 100) / 100;
  const targetId = String(payment.discountTargetId || "").trim();
  if (amount <= 0 || !targetId) return [];

  return [
    {
      ...base,
      role: payment.discountTargetRole === "receptionist" ? "receptionist" : "staff",
      id: targetId,
      name: String(payment.discountTargetName || "").trim() || targetId,
      percent: 0,
      amount,
    },
  ];
}

export function collectDiscountRows(payments = []) {
  return (payments || []).flatMap((payment) => listDiscountRowsFromPayment(payment));
}

export function sumDiscountForPerson(payments, role, personId) {
  const key = String(personId || "")
    .trim()
    .toUpperCase();
  if (!key) return 0;
  return collectDiscountRows(payments)
    .filter(
      (row) =>
        row.role === role &&
        String(row.id || "")
          .trim()
          .toUpperCase() === key
    )
    .reduce((sum, row) => sum + row.amount, 0);
}

/** Monto de descuento que absorbe una manicurista en un pago concreto. */
export function staffDiscountHit(payment, staffId) {
  return sumDiscountForPerson([payment], "staff", staffId);
}

export function summarizeDiscountsByPerson(payments = []) {
  const map = new Map();

  for (const row of collectDiscountRows(payments)) {
    const key = `${row.role}:${String(row.id).trim().toUpperCase()}`;
    const prev = map.get(key);
    if (prev) {
      prev.amount = Math.round((prev.amount + row.amount) * 100) / 100;
      prev.count += 1;
    } else {
      map.set(key, {
        role: row.role,
        id: row.id,
        name: row.name,
        amount: row.amount,
        count: 1,
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.role !== b.role) return a.role === "receptionist" ? -1 : 1;
    return b.amount - a.amount;
  });
}
