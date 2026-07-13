import mongoose from "mongoose";

const posExpenseCategorySchema = mongoose.Schema(
  {
    categoryCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    allowedRoles: {
      type: String,
      enum: ["reception", "accountant", "both"],
      default: "both",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

posExpenseCategorySchema.index({ isActive: 1, name: 1 });

if (mongoose.models.PosExpenseCategory) {
  delete mongoose.models.PosExpenseCategory;
}

export default mongoose.model("PosExpenseCategory", posExpenseCategorySchema);
