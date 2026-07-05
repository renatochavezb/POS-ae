import PosPayment from "@/models/PosPayment";
import PosCashSession from "@/models/PosCashSession";

export const PAYMENT_METHODS = ["efectivo", "tarjeta", "transferencia", "mixto"];

export function resolvePaymentBreakdown({ method, amount, tip = 0, cashAmount, cardAmount, transferAmount }) {
  const serviceTotal = Number(amount) || 0;
  const tipValue = Number(tip) || 0;
  const total = serviceTotal + tipValue;

  if (method === "mixto") {
    const cash = Number(cashAmount) || 0;
    const card = Number(cardAmount) || 0;
    const transfer = Number(transferAmount) || 0;
    const breakdownTotal = cash + card + transfer;

    if (Math.abs(breakdownTotal - total) > 0.009) {
      throw new Error("Los montos del pago mixto no coinciden con el total.");
    }

    return { amount: serviceTotal, tip: tipValue, total, cashAmount: cash, cardAmount: card, transferAmount: transfer };
  }

  if (method === "efectivo") {
    return { amount: serviceTotal, tip: tipValue, total, cashAmount: total, cardAmount: 0, transferAmount: 0 };
  }

  if (method === "tarjeta") {
    return { amount: serviceTotal, tip: tipValue, total, cashAmount: 0, cardAmount: total, transferAmount: 0 };
  }

  if (method === "transferencia") {
    return { amount: serviceTotal, tip: tipValue, total, cashAmount: 0, cardAmount: 0, transferAmount: total };
  }

  throw new Error("Método de pago no válido.");
}

export async function getOpenCashSession() {
  return PosCashSession.findOne({ status: "open" }).sort({ createdAt: -1 });
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

export function summarizePayments(payments = []) {
  return payments.reduce(
    (acc, payment) => {
      acc.count += 1;
      acc.total += payment.total ?? 0;
      acc.efectivo += payment.cashAmount ?? 0;
      acc.tarjeta += payment.cardAmount ?? 0;
      acc.transferencia += payment.transferAmount ?? 0;
      acc.tips += payment.tip ?? 0;
      acc.services += payment.amount ?? 0;
      return acc;
    },
    {
      count: 0,
      total: 0,
      efectivo: 0,
      tarjeta: 0,
      transferencia: 0,
      tips: 0,
      services: 0,
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
      },
    }
  );

  return summary;
}
