import PosAppointment from "@/models/PosAppointment";
import PosPayment from "@/models/PosPayment";
import PosStaff from "@/models/PosStaff";
import { compareSpanishShortDates } from "@/libs/spanishDateUtils";
import { normalizeAppointmentStatus } from "@/components/pos/appointmentStatus";
import { staffDiscountHit } from "@/libs/posPaymentDiscounts";
import { staffWarrantyDelta } from "@/libs/posWarranty";

function isPaidAppointment(status) {
  return normalizeAppointmentStatus(status) === "terminado";
}

function appointmentInPeriod(appointmentDate, periodMode, startLabel, endLabel) {
  if (periodMode === "day" || startLabel === endLabel) {
    return appointmentDate === startLabel;
  }

  return (
    compareSpanishShortDates(appointmentDate, startLabel) >= 0 &&
    compareSpanishShortDates(appointmentDate, endLabel) <= 0
  );
}

function buildAppointmentSnapshot(appointment, commissionPercent) {
  const cost = appointment.cost || 0;
  const commissionAmount = cost * (commissionPercent / 100);

  return {
    appointmentCode: appointment.appointmentCode,
    date: appointment.date || "",
    time: appointment.time || "",
    clientName: appointment.clientName || "",
    serviceName: appointment.serviceName || "",
    cost,
    commissionAmount,
    status: appointment.status || "terminado",
  };
}

/**
 * Citas terminadas del periodo + FKs a PosPayment y PosCashSession.
 * Usado en liquidaciones y reportes de contabilidad.
 */
export async function collectStaffPeriodSourceData({
  staffId,
  periodMode,
  periodStartLabel,
  periodEndLabel,
}) {
  const staff = await PosStaff.findOne({ staffCode: staffId });

  if (!staff) {
    throw new Error("Manicurista no encontrada");
  }

  const appointments = await PosAppointment.find({ staffId }).lean();
  const paidInPeriod = appointments.filter(
    (appointment) =>
      isPaidAppointment(appointment.status) &&
      appointmentInPeriod(
        appointment.date,
        periodMode,
        periodStartLabel,
        periodEndLabel
      )
  );

  const commissionPercent = staff.commissionPercent ?? 40;
  const appointmentCodes = paidInPeriod.map((row) => row.appointmentCode).filter(Boolean);

  const payments =
    appointmentCodes.length > 0
      ? await PosPayment.find({
          appointmentCode: { $in: appointmentCodes },
        }).lean()
      : [];

  const paymentByAppointment = new Map();
  for (const payment of payments) {
    const code = payment.appointmentCode;
    if (!code) continue;
    const prev = paymentByAppointment.get(code);
    if (!prev || String(payment.createdAt || "") > String(prev.createdAt || "")) {
      paymentByAppointment.set(code, payment);
    }
  }

  const appointmentSnapshots = paidInPeriod.map((appointment) => {
    const base = buildAppointmentSnapshot(appointment, commissionPercent);
    const payment = paymentByAppointment.get(appointment.appointmentCode);
    const discountAmount = Math.round(staffDiscountHit(payment, staffId) * 100) / 100;
    return {
      ...base,
      discountAmount,
      commissionAmount: Math.max(
        0,
        Math.round((base.commissionAmount - discountAmount) * 100) / 100
      ),
    };
  });

  const warrantyPayments = await PosPayment.find({
    isWarranty: true,
    $or: [
      { warrantyOriginalStaffId: staffId },
      { warrantyPerformedByStaffId: staffId },
    ],
  }).lean();

  const warrantyInPeriod = warrantyPayments.filter((payment) =>
    appointmentInPeriod(
      payment.appointmentDate,
      periodMode,
      periodStartLabel,
      periodEndLabel
    )
  );

  const warrantyNet = warrantyInPeriod.reduce(
    (sum, payment) => sum + staffWarrantyDelta(payment, staffId),
    0
  );

  const paymentCodes = [
    ...new Set(
      [
        ...payments.map((payment) => payment.paymentCode),
        ...warrantyInPeriod.map((payment) => payment.paymentCode),
      ].filter(Boolean)
    ),
  ];
  const cashSessionCodes = [
    ...new Set(
      [
        ...payments.map((payment) => payment.cashSessionCode),
        ...warrantyInPeriod.map((payment) => payment.cashSessionCode),
      ].filter(Boolean)
    ),
  ];

  const grossAmount = appointmentSnapshots.reduce((sum, row) => sum + row.cost, 0);
  const commissionFromAppointments = appointmentSnapshots.reduce(
    (sum, row) => sum + row.commissionAmount,
    0
  );
  const commissionAmount = Math.max(
    0,
    Math.round((commissionFromAppointments + warrantyNet) * 100) / 100
  );

  return {
    staffName: staff.name,
    grossAmount,
    commissionAmount,
    paidAmount: commissionAmount,
    commissionPercent,
    warrantyNet,
    warrantyCount: warrantyInPeriod.length,
    appointmentCount: appointmentSnapshots.length,
    appointmentCodes,
    appointmentSnapshots,
    paymentCodes,
    cashSessionCodes,
    reportSnapshot: appointmentSnapshots,
  };
}
