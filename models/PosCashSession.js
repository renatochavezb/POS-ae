import mongoose from "mongoose";

const posCashSessionSchema = mongoose.Schema(
  {
    sessionCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
    shiftDate: {
      type: String,
      required: true,
      trim: true,
    },
    openedByReceptionistId: {
      type: String,
      default: "",
      trim: true,
    },
    openedByReceptionistName: {
      type: String,
      default: "",
      trim: true,
    },
    closedByReceptionistId: {
      type: String,
      default: "",
      trim: true,
    },
    closedByReceptionistName: {
      type: String,
      default: "",
      trim: true,
    },
    openingFloat: {
      type: Number,
      default: 0,
      min: 0,
    },
    closingCountedCash: {
      type: Number,
      default: 0,
      min: 0,
    },
    expectedCash: {
      type: Number,
      default: 0,
    },
    variance: {
      type: Number,
      default: 0,
    },
    paymentsCount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    totalEfectivo: {
      type: Number,
      default: 0,
    },
    totalTarjeta: {
      type: Number,
      default: 0,
    },
    totalTransferencia: {
      type: Number,
      default: 0,
    },
    closingNotes: {
      type: String,
      default: "",
      trim: true,
    },
    closedAt: {
      type: Date,
    },
    openedWithMasterPin: {
      type: Boolean,
      default: false,
    },
    closedWithMasterPin: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

posCashSessionSchema.index({ status: 1 });
posCashSessionSchema.index({ shiftDate: 1 });

if (mongoose.models.PosCashSession) {
  delete mongoose.models.PosCashSession;
}

export default mongoose.model("PosCashSession", posCashSessionSchema);
