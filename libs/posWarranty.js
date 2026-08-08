/**
 * Garantía: cliente $0 en caja; el salón no se mueve.
 * Si otra manicurista rehace el trabajo, se traspasa el monto de comisión
 * de quien falló → quien terminó la garantía.
 */

export function normalizeWarrantyPayload(body = {}) {
  const originalStaffId = String(body?.warrantyOriginalStaffId || "").trim().toUpperCase();
  const originalStaffName =
    String(body?.warrantyOriginalStaffName || "").trim() || originalStaffId;
  const performedByStaffId = String(body?.warrantyPerformedByStaffId || "")
    .trim()
    .toUpperCase();
  const performedByStaffName =
    String(body?.warrantyPerformedByStaffName || "").trim() || performedByStaffId;
  const workDescription = String(body?.warrantyWorkDescription || "").trim();
  const serviceAmount = Math.max(0, Number(body?.warrantyServiceAmount) || 0);

  if (!originalStaffId) {
    throw new Error("Indica la manicurista que hizo el servicio original (quién falló).");
  }
  if (!performedByStaffId) {
    throw new Error("Indica quién realiza la garantía.");
  }
  if (!workDescription) {
    throw new Error("Describe qué trabajo se vuelve a hacer en la garantía.");
  }
  if (serviceAmount <= 0) {
    throw new Error("Indica el monto del trabajo en garantía (todo o solo la parte).");
  }

  const sameStaff = originalStaffId === performedByStaffId;
  /** Monto que se mueve en comisión; 0 si la misma manicurista rehace. */
  const transferAmount = sameStaff ? 0 : Math.round(serviceAmount * 100) / 100;

  return {
    warrantyOriginalStaffId: originalStaffId,
    warrantyOriginalStaffName: originalStaffName,
    warrantyPerformedByStaffId: performedByStaffId,
    warrantyPerformedByStaffName: performedByStaffName,
    warrantyWorkDescription: workDescription,
    warrantyServiceAmount: Math.round(serviceAmount * 100) / 100,
    warrantyTransferAmount: transferAmount,
    warrantySameStaff: sameStaff,
  };
}

/** Ajuste de comisión por garantías en un pago (+ crédito / − cargo). */
export function staffWarrantyDelta(payment, staffId) {
  if (!payment?.isWarranty || !staffId) return 0;
  const key = String(staffId).trim().toUpperCase();
  const original = String(payment.warrantyOriginalStaffId || "")
    .trim()
    .toUpperCase();
  const performer = String(payment.warrantyPerformedByStaffId || "")
    .trim()
    .toUpperCase();
  const transfer = Math.round((Number(payment.warrantyTransferAmount) || 0) * 100) / 100;

  if (transfer <= 0) return 0;
  if (key === original && key !== performer) return -transfer;
  if (key === performer && key !== original) return transfer;
  return 0;
}

export function listWarrantyRowsFromPayment(payment) {
  if (!payment?.isWarranty) return [];

  const serviceAmount = Math.round((Number(payment.warrantyServiceAmount) || 0) * 100) / 100;
  const transferAmount = Math.round((Number(payment.warrantyTransferAmount) || 0) * 100) / 100;
  const sameStaff = Boolean(
    payment.warrantySameStaff ||
      String(payment.warrantyOriginalStaffId || "").toUpperCase() ===
        String(payment.warrantyPerformedByStaffId || "").toUpperCase()
  );

  return [
    {
      paymentId: payment.id || payment.paymentCode || "",
      appointmentId: payment.appointmentId || payment.appointmentCode || "",
      appointmentDate: payment.appointmentDate || "",
      clientName: payment.clientName || "",
      workDescription:
        payment.warrantyWorkDescription || payment.serviceName || "Garantía",
      originalStaffId: payment.warrantyOriginalStaffId || "",
      originalStaffName: payment.warrantyOriginalStaffName || "",
      performedByStaffId: payment.warrantyPerformedByStaffId || "",
      performedByStaffName: payment.warrantyPerformedByStaffName || "",
      serviceAmount,
      transferAmount,
      sameStaff,
    },
  ];
}

export function collectWarrantyRows(payments = []) {
  return (payments || []).flatMap((payment) => listWarrantyRowsFromPayment(payment));
}

/** Movimientos de garantía que afectan a una manicurista (tablero). */
export function warrantyMovementsForStaff(payments, staffId) {
  const key = String(staffId || "")
    .trim()
    .toUpperCase();
  if (!key) return [];

  const movements = [];
  for (const row of collectWarrantyRows(payments)) {
    const isOriginal = String(row.originalStaffId).toUpperCase() === key;
    const isPerformer = String(row.performedByStaffId).toUpperCase() === key;
    if (!isOriginal && !isPerformer) continue;

    if (row.sameStaff && isOriginal) {
      movements.push({
        ...row,
        type: "same",
        label: "Garantía hecha por ella misma · sin traspaso",
        amount: 0,
        signedAmount: 0,
      });
      continue;
    }

    if (isOriginal && !row.sameStaff) {
      movements.push({
        ...row,
        type: "debit",
        label: `Se le DESCUENTA (servicio original) · lo recibe ${row.performedByStaffName}`,
        amount: row.transferAmount,
        signedAmount: -row.transferAmount,
      });
    }
    if (isPerformer && !row.sameStaff) {
      movements.push({
        ...row,
        type: "credit",
        label: `Se le SUMA (realizó la garantía) · sale de ${row.originalStaffName}`,
        amount: row.transferAmount,
        signedAmount: row.transferAmount,
      });
    }
  }
  return movements;
}
