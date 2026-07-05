import mongoose from "mongoose";

const posDailySnapshotSchema = mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    citas: {
      type: Number,
      default: 0,
    },
    sinConfirmar: {
      type: Number,
      default: 0,
    },
    pagadas: {
      type: Number,
      default: 0,
    },
    canceladas: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

if (mongoose.models.PosDailySnapshot) {
  delete mongoose.models.PosDailySnapshot;
}

export default mongoose.model("PosDailySnapshot", posDailySnapshotSchema);
