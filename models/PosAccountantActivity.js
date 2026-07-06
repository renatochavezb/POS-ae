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

const posAccountantActivitySchema = mongoose.Schema(
  {
    activityCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
    action: {
      type: String,
      enum: ["login", "logout", "report_download", "liquidation"],
      required: true,
    },
    staffId: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    staffName: {
      type: String,
      default: "",
      trim: true,
    },
    periodMode: {
      type: String,
      enum: ["day", "period", ""],
      default: "",
    },
    periodStartLabel: {
      type: String,
      default: "",
      trim: true,
    },
    periodEndLabel: {
      type: String,
      default: "",
      trim: true,
    },
    periodStartYmd: {
      type: String,
      default: "",
      trim: true,
    },
    periodEndYmd: {
      type: String,
      default: "",
      trim: true,
    },
    settlementCode: {
      type: String,
      default: "",
      trim: true,
    },
    /** FK lógica del reporte descargado (action: report_download). */
    reportCode: {
      type: String,
      default: "",
      trim: true,
    },
    /** Snapshot del reporte al descargar (filas con citas y montos). */
    reportSnapshot: {
      type: [appointmentSnapshotSchema],
      default: [],
    },
    /** FK → PosAppointment.appointmentCode */
    appointmentCodes: {
      type: [String],
      default: [],
    },
    /** FK → PosPayment.paymentCode */
    paymentCodes: {
      type: [String],
      default: [],
    },
    /** FK → PosCashSession.sessionCode */
    cashSessionCodes: {
      type: [String],
      default: [],
    },
    /** FK → PosLoginAudit */
    loginAuditId: {
      type: String,
      default: "",
      trim: true,
    },
    /** manual | browser_close */
    logoutReason: {
      type: String,
      default: "",
      trim: true,
    },
    isMasterSession: {
      type: Boolean,
      default: false,
    },
    appointmentCount: {
      type: Number,
      default: 0,
    },
    grossAmount: {
      type: Number,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    activityAt: {
      type: Date,
      required: true,
    },
    activityDateLabel: {
      type: String,
      required: true,
      trim: true,
    },
    activityTimeLabel: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

posAccountantActivitySchema.index({ accountantId: 1, activityAt: -1 });
posAccountantActivitySchema.index({ action: 1, activityAt: -1 });
posAccountantActivitySchema.index({ staffId: 1, activityAt: -1 });

export default mongoose.models?.PosAccountantActivity ||
  mongoose.model("PosAccountantActivity", posAccountantActivitySchema);
