import mongoose from "mongoose";

const posReceptionistSchema = mongoose.Schema(
  {
    receptionistCode: {
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
      default: "Recepción",
      trim: true,
    },
    loginCode: {
      type: String,
      required: true,
      trim: true,
    },
    bookingsToday: {
      type: Number,
      default: 0,
    },
    bookingsTodayDate: {
      type: String,
      default: "",
      trim: true,
    },
    image: {
      type: String,
      default: "",
    },
    color: {
      type: String,
      required: true,
    },
    colorLight: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.PosReceptionist ||
  mongoose.model("PosReceptionist", posReceptionistSchema);
