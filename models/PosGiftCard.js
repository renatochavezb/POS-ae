import mongoose from "mongoose";

const posGiftCardSchema = mongoose.Schema(
  {
    giftCardCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    initialValue: {
      type: Number,
      required: true,
      min: 0.01,
    },
    balance: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["active", "redeemed", "cancelled"],
      default: "active",
    },
    soldDate: {
      type: String,
      required: true,
      trim: true,
    },
    soldAt: {
      type: Date,
      default: Date.now,
    },
    paymentCode: {
      type: String,
      required: true,
      trim: true,
    },
    cashSessionCode: {
      type: String,
      required: true,
      trim: true,
    },
    purchaseMethod: {
      type: String,
      enum: ["efectivo", "tarjeta", "transferencia", "mixto"],
      required: true,
    },
    soldByReceptionistId: {
      type: String,
      default: "",
      trim: true,
    },
    soldByReceptionistName: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    redeemedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

posGiftCardSchema.index({ status: 1 });
posGiftCardSchema.index({ soldDate: 1 });
posGiftCardSchema.index({ cashSessionCode: 1 });

if (mongoose.models.PosGiftCard) {
  delete mongoose.models.PosGiftCard;
}

export default mongoose.model("PosGiftCard", posGiftCardSchema);
