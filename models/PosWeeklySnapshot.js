import mongoose from "mongoose";

const dayBreakdownSchema = mongoose.Schema(
  {
    dateLabel: { type: String, default: "", trim: true },
    dayLabel: { type: String, default: "", trim: true },
    count: { type: Number, default: 0 },
    sales: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
  },
  { _id: false }
);

const staffBreakdownSchema = mongoose.Schema(
  {
    staffId: { type: String, default: "", trim: true },
    staffName: { type: String, default: "", trim: true },
    count: { type: Number, default: 0 },
    sales: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    commissionPercent: { type: Number, default: 40 },
  },
  { _id: false }
);

const cutTurnSchema = mongoose.Schema(
  {
    sessionCode: { type: String, default: "", trim: true },
    shiftDate: { type: String, default: "", trim: true },
    totalAmount: { type: Number, default: 0 },
    paymentsCount: { type: Number, default: 0 },
    receptionistName: { type: String, default: "", trim: true },
    closedAt: { type: Date },
  },
  { _id: false }
);

const cutReceptionistSchema = mongoose.Schema(
  {
    receptionistId: { type: String, default: "", trim: true },
    name: { type: String, default: "", trim: true },
    count: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const posWeeklySnapshotSchema = mongoose.Schema(
  {
    weekStartDate: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    weekEndDate: {
      type: String,
      required: true,
      trim: true,
    },
    weekRangeLabel: {
      type: String,
      default: "",
      trim: true,
    },
    completedAppointmentsCount: {
      type: Number,
      default: 0,
    },
    completedByDay: {
      type: [dayBreakdownSchema],
      default: [],
    },
    completedByStaff: {
      type: [staffBreakdownSchema],
      default: [],
    },
    previousWeekCompletedCount: {
      type: Number,
      default: 0,
    },
    completedWeekDeltaPercent: {
      type: Number,
      default: null,
    },
    grossSales: {
      type: Number,
      default: 0,
    },
    estimatedCommission: {
      type: Number,
      default: 0,
    },
    tips: {
      type: Number,
      default: 0,
    },
    salonNet: {
      type: Number,
      default: 0,
    },
    salesByDay: {
      type: [dayBreakdownSchema],
      default: [],
    },
    salesByStaff: {
      type: [staffBreakdownSchema],
      default: [],
    },
    previousWeekGrossSales: {
      type: Number,
      default: 0,
    },
    grossSalesWeekDeltaPercent: {
      type: Number,
      default: null,
    },
    cutsCount: {
      type: Number,
      default: 0,
    },
    cutsTotal: {
      type: Number,
      default: 0,
    },
    cutsTotalEfectivo: {
      type: Number,
      default: 0,
    },
    cutsTotalTarjeta: {
      type: Number,
      default: 0,
    },
    cutsTotalTransferencia: {
      type: Number,
      default: 0,
    },
    cutsByTurn: {
      type: [cutTurnSchema],
      default: [],
    },
    cutsByReceptionist: {
      type: [cutReceptionistSchema],
      default: [],
    },
    computedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

posWeeklySnapshotSchema.index({ weekStartDate: 1 });

if (mongoose.models.PosWeeklySnapshot) {
  delete mongoose.models.PosWeeklySnapshot;
}

export default mongoose.model("PosWeeklySnapshot", posWeeklySnapshotSchema);
