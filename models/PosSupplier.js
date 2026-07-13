import mongoose from "mongoose";

const posSupplierSchema = mongoose.Schema(
  {
    supplierCode: {
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
    contactName: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
    },
    taxId: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      default: "general",
      trim: true,
    },
    paymentTerms: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    recordedByRole: {
      type: String,
      enum: ["reception", "accountant", "master"],
      default: "accountant",
    },
    recordedById: {
      type: String,
      default: "",
      trim: true,
    },
    recordedByName: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

posSupplierSchema.index({ isActive: 1, name: 1 });
posSupplierSchema.index({ category: 1 });

if (mongoose.models.PosSupplier) {
  delete mongoose.models.PosSupplier;
}

export default mongoose.model("PosSupplier", posSupplierSchema);
