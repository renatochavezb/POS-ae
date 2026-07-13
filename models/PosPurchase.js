import mongoose from "mongoose";

const purchaseLineSchema = {
  itemCode: { type: String, default: "", trim: true },
  name: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unitCost: { type: Number, required: true, min: 0 },
  subtotal: { type: Number, required: true, min: 0 },
};

const posPurchaseSchema = mongoose.Schema(
  {
    purchaseCode: {
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
    purchaseDate: {
      type: String,
      required: true,
      trim: true,
    },
    items: {
      type: [purchaseLineSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["borrador", "recibida", "cancelada"],
      default: "recibida",
    },
    paymentStatus: {
      type: String,
      enum: ["pendiente", "parcial", "pagada"],
      default: "pendiente",
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

posPurchaseSchema.index({ purchaseDate: -1 });
posPurchaseSchema.index({ supplierCode: 1 });
posPurchaseSchema.index({ status: 1, paymentStatus: 1 });

if (mongoose.models.PosPurchase) {
  delete mongoose.models.PosPurchase;
}

export default mongoose.model("PosPurchase", posPurchaseSchema);
