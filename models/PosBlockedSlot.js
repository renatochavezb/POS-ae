import mongoose from "mongoose";

const posBlockedSlotSchema = mongoose.Schema(
  {
    blockedSlotCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
    },
    staffId: {
      type: String,
      required: true,
      trim: true,
    },
    time: {
      type: String,
      required: true,
      trim: true,
    },
    duration: {
      type: Number,
      default: 30,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

posBlockedSlotSchema.index({ date: 1, staffId: 1, time: 1 });

export default mongoose.models.PosBlockedSlot ||
  mongoose.model("PosBlockedSlot", posBlockedSlotSchema);
