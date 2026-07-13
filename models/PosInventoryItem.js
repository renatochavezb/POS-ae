import mongoose from "mongoose";

const posInventoryItemSchema = mongoose.Schema(
  {
    itemCode: {
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
    category: {
      type: String,
      default: "consumibles",
      trim: true,
    },
    system: {
      type: String,
      default: "universal",
      trim: true,
    },
    brand: {
      type: String,
      default: "",
      trim: true,
    },
    shade: {
      type: String,
      default: "",
      trim: true,
    },
    unit: {
      type: String,
      default: "pieza",
      trim: true,
    },
    currentStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    minStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    unitCost: {
      type: Number,
      default: 0,
      min: 0,
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
    lastRestockedAt: {
      type: Date,
      default: null,
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
      default: "reception",
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

posInventoryItemSchema.index({ isActive: 1, name: 1 });
posInventoryItemSchema.index({ category: 1 });
posInventoryItemSchema.index({ currentStock: 1, minStock: 1 });

if (mongoose.models.PosInventoryItem) {
  delete mongoose.models.PosInventoryItem;
}

export default mongoose.model("PosInventoryItem", posInventoryItemSchema);
