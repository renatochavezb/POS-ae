import mongoose from "mongoose";

const posInventoryCategorySchema = mongoose.Schema(
  {
    categoryCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
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
    sortOrder: {
      type: Number,
      default: 0,
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
  { timestamps: true }
);

posInventoryCategorySchema.index({ isActive: 1, sortOrder: 1, name: 1 });

if (mongoose.models.PosInventoryCategory) {
  delete mongoose.models.PosInventoryCategory;
}

export default mongoose.model("PosInventoryCategory", posInventoryCategorySchema);
