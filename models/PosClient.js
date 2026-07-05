import mongoose from "mongoose";

const styleProfileSchema = mongoose.Schema(
  {
    bio: { type: String, default: "" },
    tags: { type: [String], default: [] },
  },
  { _id: false }
);

const posClientSchema = mongoose.Schema(
  {
    clientCode: {
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
    email: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    birthday: {
      type: String,
      default: "No especificado",
      trim: true,
    },
    address: {
      type: String,
      default: "No especificada",
      trim: true,
    },
    isPlatinum: {
      type: Boolean,
      default: false,
    },
    memberSince: {
      type: String,
      default: "",
      trim: true,
    },
    bio: {
      type: String,
      default: "",
    },
    styleProfile: {
      type: styleProfileSchema,
      default: () => ({ bio: "", tags: [] }),
    },
    alerts: {
      type: [String],
      default: [],
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    visitsCount: {
      type: Number,
      default: 0,
    },
    averageTicket: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.PosClient ||
  mongoose.model("PosClient", posClientSchema);
