import mongoose from "mongoose";

const appointmentSnapshotSchema = new mongoose.Schema(
  {
    appointmentCode: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String,
      default: "",
      trim: true,
    },
    time: {
      type: String,
      default: "",
      trim: true,
    },
    clientName: {
      type: String,
      default: "",
      trim: true,
    },
    serviceName: {
      type: String,
      default: "",
      trim: true,
    },
    cost: {
      type: Number,
      default: 0,
    },
    commissionAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      default: "pagado",
      trim: true,
    },
  },
  { _id: false }
);

const posStaffSettlementSchema = mongoose.Schema(
  {
    settlementCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    staffId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    staffName: {
      type: String,
      required: true,
      trim: true,
    },
    periodMode: {
      type: String,
      enum: ["day", "period"],
      required: true,
    },
    periodStartLabel: {
      type: String,
      required: true,
      trim: true,
    },
    periodEndLabel: {
      type: String,
      required: true,
      trim: true,
    },
    periodStartYmd: {
      type: String,
      required: true,
      trim: true,
    },
    periodEndYmd: {
      type: String,
      required: true,
      trim: true,
    },
    settledAt: {
      type: Date,
      required: true,
    },
    settledDateLabel: {
      type: String,
      required: true,
      trim: true,
    },
    grossAmount: {
      type: Number,
      default: 0,
    },
    commissionAmount: {
      type: Number,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    commissionPercent: {
      type: Number,
      default: 40,
    },
    appointmentCount: {
      type: Number,
      default: 0,
    },
    accountantId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    accountantName: {
      type: String,
      required: true,
      trim: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    /** FK → PosAppointment.appointmentCode (citas incluidas al liquidar). */
    appointmentCodes: {
      type: [String],
      default: [],
    },
    /** Snapshot congelado de cada cita al momento de liquidar. */
    appointmentSnapshots: {
      type: [appointmentSnapshotSchema],
      default: [],
    },
    /** FK → PosPayment.paymentCode (cobros de esas citas). */
    paymentCodes: {
      type: [String],
      default: [],
    },
    /** FK → PosCashSession.sessionCode (turnos de caja involucrados). */
    cashSessionCodes: {
      type: [String],
      default: [],
    },
    /** FK → PosLoginAudit (auditoría de autorización). */
    loginAuditId: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

posStaffSettlementSchema.index({ staffId: 1, settledAt: -1 });
posStaffSettlementSchema.index(
  { staffId: 1, periodStartYmd: 1, periodEndYmd: 1 },
  { unique: true }
);

export default mongoose.models?.PosStaffSettlement ||
  mongoose.model("PosStaffSettlement", posStaffSettlementSchema);
