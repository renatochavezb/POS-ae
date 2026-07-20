import mongoose from "mongoose";

const posServiceSchema = mongoose.Schema(
  {
    serviceCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      default: "",
      trim: true,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    duration: {
      type: Number,
      default: 60,
      min: 0,
    },
    image: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    staffIds: {
      type: [String],
      default: [],
    },
    exclusive: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    /** fixed = precio cerrado; per_nail = precio unitario × cantidad de uñas */
    pricingMode: {
      type: String,
      enum: ["fixed", "per_nail"],
      default: "fixed",
    },
    /** Tope de multiplicador (típicamente 10 manos / 20 manos+pies). */
    nailMax: {
      type: Number,
      default: 1,
      min: 1,
      max: 40,
    },
    /** Orden de visualización: lista de precios primero (1..N), legacy después. */
    sortOrder: {
      type: Number,
      default: 1000,
      min: 0,
    },
    /** price_list = lista oficial; legacy = catálogo previo. */
    source: {
      type: String,
      enum: ["price_list", "legacy"],
      default: "legacy",
    },
  },
  {
    timestamps: true,
  }
);

posServiceSchema.index({ category: 1, isActive: 1 });
posServiceSchema.index({ sortOrder: 1, name: 1 });
posServiceSchema.index({ source: 1, sortOrder: 1 });

if (mongoose.models.PosService) {
  delete mongoose.models.PosService;
}

export default mongoose.model("PosService", posServiceSchema);
