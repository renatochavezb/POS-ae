import mongoose from "mongoose";

const posMarketingAgencySchema = mongoose.Schema(
  {
    agencyCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      default: "Mercadotecnia",
      trim: true,
    },
    loginCode: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
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

export default mongoose.models?.PosMarketingAgency ||
  mongoose.model("PosMarketingAgency", posMarketingAgencySchema);
