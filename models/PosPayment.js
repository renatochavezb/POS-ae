import mongoose from "mongoose";

const posPaymentSchema = mongoose.Schema(
  {
    paymentCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    appointmentCode: {
      type: String,
      required: true,
      trim: true,
    },
    appointmentDate: {
      type: String,
      required: true,
      trim: true,
    },
    clientId: {
      type: String,
      default: "",
      trim: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    staffId: {
      type: String,
      default: "",
      trim: true,
    },
    staffName: {
      type: String,
      default: "",
      trim: true,
    },
    ticketCode: {
      type: String,
      default: "",
      trim: true,
    },
    serviceName: {
      type: String,
      default: "",
      trim: true,
    },
    serviceLines: {
      type: [
        {
          serviceId: { type: String, default: "", trim: true },
          name: { type: String, required: true, trim: true },
          price: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    tip: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    method: {
      type: String,
      enum: ["efectivo", "tarjeta", "transferencia", "gift_card", "mixto"],
      required: true,
    },
    cashAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    cardAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    transferAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    giftCardAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    cashSessionCode: {
      type: String,
      default: "",
      trim: true,
    },
    processedByReceptionistId: {
      type: String,
      default: "",
      trim: true,
    },
    processedByReceptionistName: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

posPaymentSchema.index({ appointmentCode: 1 });
posPaymentSchema.index({ appointmentDate: 1 });
posPaymentSchema.index({ cashSessionCode: 1 });
posPaymentSchema.index({ createdAt: -1 });

if (mongoose.models.PosPayment) {
  delete mongoose.models.PosPayment;
}

export default mongoose.model("PosPayment", posPaymentSchema);
