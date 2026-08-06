import PosPayment from "@/models/PosPayment";
import PosCashSession from "@/models/PosCashSession";
import { logCashRegisterAudit } from "@/libs/posReceptionistAuth";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";

export const PAYMENT_METHODS = ["efectivo", "tarjeta", "transferencia", "gift_card", "mixto"];

export function resolvePaymentBreakdown({
  method,
  amount,
  tip = 0,
  discount = 0,
  isWarranty = false,
  cashAmount,
  cardAmount,
  transferAmount,
}) {
  const serviceGross = Number(amount) || 0;
  const tipValue = Number(tip) || 0;
  const discountValue = Math.max(0, Number(discount) || 0);
  const warranty = Boolean(isWarranty);

  if (warranty) {
    // Garantía: no se cobra el servicio; la propina sí puede aplicar.
    const total = tipValue;
    return finishBreakdown(method, {
      amount: 0,
      serviceGross,
      tip: tipValue,
      discount: serviceGross,
      isWarranty: true,
      total,
      cashAmount,
      cardAmount,
      transferAmount,
    });
  }

  if (discountValue > serviceGross + 0.009) {
    throw new Error("El descuento no puede ser mayor al importe del servicio.");
  }

  const serviceNet = Math.max(0, serviceGross - discountValue);
  const total = serviceNet + tipValue;

  return finishBreakdown(method, {
    amount: serviceNet,
    serviceGross,
    tip: tipValue,
    discount: discountValue,
    isWarranty: false,
    total,
    cashAmount,
    cardAmount,
    transferAmount,
  });
}

function finishBreakdown(method, base) {
  const { total, cashAmount, cardAmount, transferAmount, ...rest } = base;

  if (method === "mixto") {
    const cash = Number(cashAmount) || 0;
    const card = Number(cardAmount) || 0;
    const transfer = Number(transferAmount) || 0;
    const breakdownTotal = cash + card + transfer;

    if (Math.abs(breakdownTotal - total) > 0.009) {
      throw new Error("Los montos del pago mixto no coinciden con el total.");
    }

    return {
      ...rest,
      total,
      cashAmount: cash,
      cardAmount: card,
      transferAmount: transfer,
      giftCardAmount: 0,
    };
  }

  if (method === "efectivo") {
    return {
      ...rest,
      total,
      cashAmount: total,
      cardAmount: 0,
      transferAmount: 0,
      giftCardAmount: 0,
    };
  }

  if (method === "tarjeta") {
    return {
      ...rest,
      total,
      cashAmount: 0,
      cardAmount: total,
      transferAmount: 0,
      giftCardAmount: 0,
    };
  }

  if (method === "transferencia") {
    return {
      ...rest,
      total,
      cashAmount: 0,
      cardAmount: 0,
      transferAmount: total,
      giftCardAmount: 0,
    };
  }

  if (method === "gift_card") {
    return {
      ...rest,
      total,
      cashAmount: 0,
      cardAmount: 0,
      transferAmount: 0,
      giftCardAmount: total,
    };
  }

  throw new Error("Método de pago no válido");
}

export async function getOpenCashSession() {
  return PosCashSession.findOne({ status: "open" }).sort({ createdAt: -1 });
}

export async function openCashSessionForReceptionist({
  receptionistId,
  receptionistName,
  isMaster = false,
  openingFloat = 0,
}) {
  const floatValue = Number(openingFloat) || 0;

  if (floatValue < 0) {
    throw new Error("El fondo de caja no puede ser negativo");
  }

  const existing = await getOpenCashSession();
  if (existing) {
    return { session: existing, created: false };
  }

  const sessionCode = `CS-${Date.now()}`;
  const created = await PosCashSession.create({
    sessionCode,
    status: "open",
    shiftDate: getTodaySpanishShortDate(),
    openedByReceptionistId: receptionistId,
    openedByReceptionistName: receptionistName,
    openingFloat: floatValue,
    openedWithMasterPin: isMaster,
  });

  await logCashRegisterAudit({
    action: "caja_open",
    receptionistId,
    receptionistName,
    success: true,
    isMaster,
    cashSessionCode: sessionCode,
    actionDetails: {
      shiftDate: created.shiftDate,
      openingFloat: floatValue,
    },
  });

  return { session: created, created: true };
}

export async function getClosedCashSessions({ date, limit = 30 } = {}) {
  const query = { status: "closed" };

  if (date) {
    query.shiftDate = date;
  }

  return PosCashSession.find(query)
    .sort({ closedAt: -1, createdAt: -1 })
    .limit(limit);
}

/** Montos por método; si faltan cash/card/transfer, deriva de method + total. */
export function paymentMethodAmounts(payment = {}) {
  const cash = Number(payment.cashAmount) || 0;
  const card = Number(payment.cardAmount) || 0;
  const transfer = Number(payment.transferAmount) || 0;
  const gift = Number(payment.giftCardAmount) || 0;
  if (cash + card + transfer + gift > 0) {
    return { efectivo: cash, tarjeta: card, transferencia: transfer, gift_card: gift };
  }

  const total = Number(payment.total) || Number(payment.amount) || 0;
  const method = String(payment.method || "").toLowerCase();
  if (total <= 0) {
    return { efectivo: 0, tarjeta: 0, transferencia: 0, gift_card: 0 };
  }
  if (method === "efectivo") {
    return { efectivo: total, tarjeta: 0, transferencia: 0, gift_card: 0 };
  }
  if (method === "tarjeta") {
    return { efectivo: 0, tarjeta: total, transferencia: 0, gift_card: 0 };
  }
  if (method === "transferencia") {
    return { efectivo: 0, tarjeta: 0, transferencia: total, gift_card: 0 };
  }
  if (method === "gift_card") {
    return { efectivo: 0, tarjeta: 0, transferencia: 0, gift_card: total };
  }
  return { efectivo: 0, tarjeta: 0, transferencia: 0, gift_card: 0 };
}

export function summarizePayments(payments = []) {
  return payments.reduce(
    (acc, payment) => {
      const methods = paymentMethodAmounts(payment);
      acc.count += 1;
      acc.total += payment.total ?? 0;
      acc.efectivo += methods.efectivo;
      acc.tarjeta += methods.tarjeta;
      acc.transferencia += methods.transferencia;
      acc.gift_card += methods.gift_card;
      acc.tips += payment.tip ?? 0;
      if (payment.transactionType === "gift_card_sale") {
        acc.giftCardSales += payment.amount ?? 0;
      } else {
        acc.services += payment.amount ?? 0;
      }
      return acc;
    },
    {
      count: 0,
      total: 0,
      efectivo: 0,
      tarjeta: 0,
      transferencia: 0,
      gift_card: 0,
      tips: 0,
      services: 0,
      giftCardSales: 0,
    }
  );
}

export async function getPaymentsForDate(date) {
  return PosPayment.find({ appointmentDate: date }).sort({ createdAt: -1 });
}

export async function getPaymentsForSession(sessionCode) {
  if (!sessionCode) return [];
  return PosPayment.find({ cashSessionCode: sessionCode }).sort({ createdAt: -1 });
}

// Cobros de un turno acotados al día operativo (fecha de la cita/venta). Así el
// turno y el corte solo consideran lo que corresponde a ese día, aunque el turno
// haya quedado abierto varios días.
export async function getPaymentsForSessionDay(sessionCode, day) {
  if (!sessionCode) return [];
  const query = { cashSessionCode: sessionCode };
  if (day) query.appointmentDate = day;
  return PosPayment.find(query).sort({ createdAt: -1 });
}

export async function computeExpectedCashForSessionDay(session, day) {
  if (!session) return 0;

  const payments = await getPaymentsForSessionDay(session.sessionCode, day);
  const cashFromPayments = payments.reduce(
    (sum, payment) => sum + (payment.cashAmount ?? 0),
    0
  );

  return (session.openingFloat ?? 0) + cashFromPayments;
}

export async function computeExpectedCashForSession(session) {
  if (!session) return 0;

  const payments = await getPaymentsForSession(session.sessionCode);
  const cashFromPayments = payments.reduce(
    (sum, payment) => sum + (payment.cashAmount ?? 0),
    0
  );

  return (session.openingFloat ?? 0) + cashFromPayments;
}

export async function refreshCashSessionTotals(sessionCode) {
  const payments = await getPaymentsForSession(sessionCode);
  const summary = summarizePayments(payments);

  await PosCashSession.updateOne(
    { sessionCode },
    {
      $set: {
        paymentsCount: summary.count,
        totalAmount: summary.total,
        totalEfectivo: summary.efectivo,
        totalTarjeta: summary.tarjeta,
        totalTransferencia: summary.transferencia,
        totalGiftCard: summary.gift_card,
        totalGiftCardSales: summary.giftCardSales,
      },
    }
  );

  return summary;
}
