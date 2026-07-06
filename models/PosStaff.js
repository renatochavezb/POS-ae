import mongoose from "mongoose";

const posStaffSchema = mongoose.Schema(
  {
    staffCode: {
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
    role: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["online", "offline", "break"],
      default: "online",
    },
    rating: {
      type: Number,
      default: 5,
    },
    specialty: {
      type: String,
      default: "",
      trim: true,
    },
    shift: {
      type: String,
      default: "Completo",
      trim: true,
    },
    completedToday: {
      type: Number,
      default: 0,
    },
    totalToday: {
      type: Number,
      default: 0,
    },
    weeklyRevenue: {
      type: Number,
      default: 0,
    },
    commissionPercent: {
      type: Number,
      default: 40,
    },
    bio: {
      type: String,
      default: "",
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
    allowedServiceIds: {
      type: [String],
      default: [],
    },
    loginCode: {
      type: String,
      default: "1234",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
    deactivatedAgendaDate: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

posStaffSchema.index({ isActive: 1 });

export default mongoose.models?.PosStaff ||
  mongoose.model("PosStaff", posStaffSchema);
