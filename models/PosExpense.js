import mongoose from "mongoose";

const posExpenseSchema = mongoose.Schema(
  {
    expenseCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    categoryCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    categoryName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    expenseDate: {
      type: String,
      required: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ["efectivo", "tarjeta", "transferencia", "cheque"],
      default: "efectivo",
    },
    status: {
      type: String,
      enum: ["pendiente", "pagado", "cancelado"],
      default: "pagado",
    },
    supplierCode: {
      type: String,
      default: "",
      trim: true,
    },
    supplierName: {
      type: String,
      default: "",
      trim: true,
    },
    receiptReference: {
      type: String,
      default: "",
      trim: true,
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
    approvedByAccountantId: {
      type: String,
      default: "",
      trim: true,
    },
    cashSessionCode: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

posExpenseSchema.index({ expenseDate: -1 });
posExpenseSchema.index({ categoryCode: 1 });
posExpenseSchema.index({ status: 1 });
posExpenseSchema.index({ createdAt: -1 });

if (mongoose.models.PosExpense) {
  delete mongoose.models.PosExpense;
}

export default mongoose.model("PosExpense", posExpenseSchema);
