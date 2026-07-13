import mongoose from "mongoose";

const posPayableSchema = mongoose.Schema(
  {
    payableCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    supplierCode: {
      type: String,
      default: "",
      trim: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    concept: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    dueDate: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pendiente", "pagada", "vencida", "cancelada"],
      default: "pendiente",
    },
    linkedExpenseCode: {
      type: String,
      default: "",
      trim: true,
    },
    linkedPurchaseCode: {
      type: String,
      default: "",
      trim: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    recordedByRole: {
      type: String,
      enum: ["reception", "accountant", "master"],
      required: true,
    },
    recordedById: {
      type: String,
      default: "",
      trim: true,
    },
    recordedByName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

posPayableSchema.index({ dueDate: 1 });
posPayableSchema.index({ status: 1 });
posPayableSchema.index({ supplierCode: 1 });

if (mongoose.models.PosPayable) {
  delete mongoose.models.PosPayable;
}

export default mongoose.model("PosPayable", posPayableSchema);
