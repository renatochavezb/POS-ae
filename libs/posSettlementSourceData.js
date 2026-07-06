import PosAppointment from "@/models/PosAppointment";
import PosPayment from "@/models/PosPayment";
import PosStaff from "@/models/PosStaff";
import { compareSpanishShortDates } from "@/libs/spanishDateUtils";
import { normalizeAppointmentStatus } from "@/components/pos/appointmentStatus";

function isPaidAppointment(status) {
  return normalizeAppointmentStatus(status) === "pagado";
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
    status: appointment.status || "pagado",
  };
}

/**
 * Citas pagadas del periodo + FKs a PosPayment y PosCashSession.
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
  const appointmentSnapshots = paidInPeriod.map((appointment) =>
    buildAppointmentSnapshot(appointment, commissionPercent)
  );
  const appointmentCodes = appointmentSnapshots.map((row) => row.appointmentCode);

  const payments =
    appointmentCodes.length > 0
      ? await PosPayment.find({
          appointmentCode: { $in: appointmentCodes },
        }).lean()
      : [];

  const paymentCodes = [...new Set(payments.map((payment) => payment.paymentCode).filter(Boolean))];
  const cashSessionCodes = [
    ...new Set(payments.map((payment) => payment.cashSessionCode).filter(Boolean)),
  ];

  const grossAmount = appointmentSnapshots.reduce((sum, row) => sum + row.cost, 0);
  const commissionAmount = appointmentSnapshots.reduce(
    (sum, row) => sum + row.commissionAmount,
    0
  );

  return {
    staffName: staff.name,
    grossAmount,
    commissionAmount,
    paidAmount: commissionAmount,
    commissionPercent,
    appointmentCount: appointmentSnapshots.length,
    appointmentCodes,
    appointmentSnapshots,
    paymentCodes,
    cashSessionCodes,
    reportSnapshot: appointmentSnapshots,
  };
}
