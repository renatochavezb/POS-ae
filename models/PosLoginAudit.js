import mongoose from "mongoose";

const posLoginAuditSchema = mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["reception", "manicurista", "accountant", "master"],
      required: true,
    },
    userId: {
      type: String,
      default: "",
      trim: true,
    },
    userName: {
      type: String,
      default: "",
      trim: true,
    },
    success: {
      type: Boolean,
      required: true,
    },
    isMaster: {
      type: Boolean,
      default: false,
    },
    action: {
      type: String,
      default: "login",
      trim: true,
    },
    cashSessionCode: {
      type: String,
      default: "",
      trim: true,
    },
    errorMessage: {
      type: String,
      default: "",
      trim: true,
    },
    actionDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

posLoginAuditSchema.index({ createdAt: -1 });

export default mongoose.models.PosLoginAudit ||
  mongoose.model("PosLoginAudit", posLoginAuditSchema);
