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
  },
  {
    timestamps: true,
  }
);

posServiceSchema.index({ category: 1, isActive: 1 });

if (mongoose.models.PosService) {
  delete mongoose.models.PosService;
}

export default mongoose.model("PosService", posServiceSchema);
