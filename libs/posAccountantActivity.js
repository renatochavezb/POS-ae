import PosAccountant from "@/models/PosAccountant";
import PosAccountantActivity from "@/models/PosAccountantActivity";
import PosStaff from "@/models/PosStaff";
import { seedPosAccountantIfEmpty } from "@/libs/posSeed";
import { formatSpanishShortDateInTimeZone } from "@/components/pos/scheduleUtils";
import { collectStaffPeriodSourceData } from "@/libs/posSettlementSourceData";

const MEXICO_TZ = "America/Mexico_City";

export function getActivityTimeLabels(date = new Date()) {
  return {
    activityAt: date,
    activityDateLabel: formatSpanishShortDateInTimeZone(date),
    activityTimeLabel: date.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: MEXICO_TZ,
    }),
  };
}

export function buildAccountantActivityCode(accountantId, action) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return `ACT-${accountantId}-${action}-${stamp}`;
}

export function buildReportCode(staffId) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return `RPT-${String(staffId || "GEN").trim().toUpperCase()}-${stamp}`;
}

async function resolveAccountant(accountantId) {
  await seedPosAccountantIfEmpty();
  const accountant = await PosAccountant.findOne({
    accountantCode: String(accountantId || "").trim().toUpperCase(),
    isActive: { $ne: false },
  });

  if (!accountant) {
    throw new Error("Contadora no encontrada");
  }

  return accountant;
}

async function resolveStaffName(staffId) {
  if (!staffId) return "";
  const staff = await PosStaff.findOne({ staffCode: String(staffId).trim().toUpperCase() });
  return staff?.name || "";
}

async function resolvePeriodLinks({
  action,
  staffId,
  periodMode,
  periodStartLabel,
  periodEndLabel,
  appointmentCount,
  grossAmount,
  paidAmount,
}) {
  if (
    (action !== "report_download" && action !== "liquidation") ||
    !staffId ||
    !periodStartLabel ||
    !periodEndLabel
  ) {
    return null;
  }

  const source = await collectStaffPeriodSourceData({
    staffId,
    periodMode: periodMode || "period",
    periodStartLabel,
    periodEndLabel,
  });

  return {
    appointmentCodes: source.appointmentCodes,
    paymentCodes: source.paymentCodes,
    cashSessionCodes: source.cashSessionCodes,
    reportSnapshot: action === "report_download" ? source.reportSnapshot : [],
    appointmentCount: appointmentCount || source.appointmentCount,
    grossAmount: grossAmount || source.grossAmount,
    paidAmount: paidAmount || source.paidAmount,
  };
}

export async function recordAccountantActivity({
  accountantId,
  action,
  staffId = "",
  staffName = "",
  periodMode = "",
  periodStartLabel = "",
  periodEndLabel = "",
  periodStartYmd = "",
  periodEndYmd = "",
  settlementCode = "",
  reportCode = "",
  appointmentCount = 0,
  grossAmount = 0,
  paidAmount = 0,
  appointmentCodes = [],
  paymentCodes = [],
  cashSessionCodes = [],
  reportSnapshot = [],
  loginAuditId = "",
  logoutReason = "",
  isMasterSession = false,
  metadata = null,
  activityAt = new Date(),
}) {
  const accountant = await resolveAccountant(accountantId);
  const labels = getActivityTimeLabels(activityAt);
  const resolvedStaffName =
    staffName || (staffId ? await resolveStaffName(staffId) : "");

  const normalizedStaffId = staffId ? String(staffId).trim().toUpperCase() : "";
  let periodLinks = null;

  if (
    !appointmentCodes.length &&
    (action === "report_download" || action === "liquidation") &&
    normalizedStaffId &&
    periodStartLabel &&
    periodEndLabel
  ) {
    periodLinks = await resolvePeriodLinks({
      action,
      staffId: normalizedStaffId,
      periodMode,
      periodStartLabel,
      periodEndLabel,
      appointmentCount,
      grossAmount,
      paidAmount,
    });
  }

  const resolvedReportCode =
    action === "report_download"
      ? reportCode || buildReportCode(normalizedStaffId || accountant.accountantCode)
      : reportCode || "";

  const created = await PosAccountantActivity.create({
    activityCode: buildAccountantActivityCode(accountant.accountantCode, action),
    accountantId: accountant.accountantCode,
    accountantName: accountant.name,
    action,
    staffId: normalizedStaffId,
    staffName: resolvedStaffName,
    periodMode: periodMode || "",
    periodStartLabel,
    periodEndLabel,
    periodStartYmd,
    periodEndYmd,
    settlementCode,
    reportCode: resolvedReportCode,
    appointmentCodes: appointmentCodes.length
      ? appointmentCodes
      : periodLinks?.appointmentCodes || [],
    paymentCodes: paymentCodes.length ? paymentCodes : periodLinks?.paymentCodes || [],
    cashSessionCodes: cashSessionCodes.length
      ? cashSessionCodes
      : periodLinks?.cashSessionCodes || [],
    reportSnapshot: reportSnapshot.length
      ? reportSnapshot
      : periodLinks?.reportSnapshot || [],
    loginAuditId: loginAuditId || "",
    logoutReason: logoutReason || "",
    isMasterSession: Boolean(isMasterSession),
    appointmentCount: periodLinks?.appointmentCount ?? appointmentCount,
    grossAmount: periodLinks?.grossAmount ?? grossAmount,
    paidAmount: periodLinks?.paidAmount ?? paidAmount,
    ...labels,
    metadata,
  });

  return created;
}
