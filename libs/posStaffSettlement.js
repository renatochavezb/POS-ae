import PosStaffSettlement from "@/models/PosStaffSettlement";
import { collectStaffPeriodSourceData } from "@/libs/posSettlementSourceData";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";

export { collectStaffPeriodSourceData };

export async function findExistingStaffSettlement({
  staffId,
  periodStartYmd,
  periodEndYmd,
}) {
  return PosStaffSettlement.findOne({
    staffId,
    periodStartYmd,
    periodEndYmd,
  }).lean();
}

export function buildSettlementCode(staffId) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return `LIQ-${staffId}-${stamp}`;
}

export async function createStaffSettlement({
  staffId,
  periodMode,
  periodStartLabel,
  periodEndLabel,
  periodStartYmd,
  periodEndYmd,
  accountantId,
  accountantName,
  notes = "",
}) {
  const existing = await findExistingStaffSettlement({
    staffId,
    periodStartYmd,
    periodEndYmd,
  });

  if (existing) {
    throw new Error("Este periodo ya fue liquidado para esta manicurista");
  }

  const source = await collectStaffPeriodSourceData({
    staffId,
    periodMode,
    periodStartLabel,
    periodEndLabel,
  });

  const settledAt = new Date();

  const created = await PosStaffSettlement.create({
    settlementCode: buildSettlementCode(staffId),
    staffId,
    staffName: source.staffName,
    periodMode,
    periodStartLabel,
    periodEndLabel,
    periodStartYmd,
    periodEndYmd,
    settledAt,
    settledDateLabel: getTodaySpanishShortDate(),
    grossAmount: source.grossAmount,
    commissionAmount: source.commissionAmount,
    paidAmount: source.paidAmount,
    commissionPercent: source.commissionPercent,
    appointmentCount: source.appointmentCount,
    accountantId,
    accountantName,
    notes,
    appointmentCodes: source.appointmentCodes,
    appointmentSnapshots: source.appointmentSnapshots,
    paymentCodes: source.paymentCodes,
    cashSessionCodes: source.cashSessionCodes,
  });

  return created;
}

// Compatibilidad con llamadas existentes.
export async function calculateStaffSettlementTotals({
  staffId,
  periodMode,
  periodStartLabel,
  periodEndLabel,
}) {
  const source = await collectStaffPeriodSourceData({
    staffId,
    periodMode,
    periodStartLabel,
    periodEndLabel,
  });

  return {
    staffName: source.staffName,
    grossAmount: source.grossAmount,
    commissionAmount: source.commissionAmount,
    paidAmount: source.paidAmount,
    commissionPercent: source.commissionPercent,
    appointmentCount: source.appointmentCount,
  };
}
