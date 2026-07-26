import mongoose from "mongoose";

const posScheduleConfigSchema = mongoose.Schema(
  {
    configCode: {
      type: String,
      required: true,
      unique: true,
      default: "default",
      trim: true,
    },
    startHour: {
      type: Number,
      default: 9,
    },
    endHour: {
      type: Number,
      default: 21,
    },
    slotIntervalMinutes: {
      type: Number,
      default: 30,
    },
    bookingDurationOptions: {
      type: [Number],
      default: [30, 45, 60, 75, 90, 120, 150, 180, 210, 240],
    },
    closeDurationOptions: {
      type: [Number],
      default: [30, 45, 60, 75, 90, 120, 150, 180, 210, 240],
    },
    closeReasons: {
      type: [String],
      default: ["Descanso", "Comida", "Capacitación", "Personal", "Otro"],
    },
    timeZone: {
      type: String,
      default: "America/Mexico_City",
      trim: true,
    },
    masterLoginCode: {
      type: String,
      default: "0000",
      trim: true,
    },
    /** Lugares físicos de cabina disponibles en el salón. */
    cabinCapacity: {
      type: Number,
      default: 12,
      min: 1,
      max: 100,
    },
    weeklyHours: {
      weekday: {
        startHour: { type: Number, default: 9 },
        endHour: { type: Number, default: 21 },
        closed: { type: Boolean, default: false },
      },
      saturday: {
        startHour: { type: Number, default: 9 },
        endHour: { type: Number, default: 18 },
        closed: { type: Boolean, default: false },
      },
      sundayHoliday: {
        startHour: { type: Number, default: 9 },
        endHour: { type: Number, default: 21 },
        closed: { type: Boolean, default: true },
      },
    },
  },
  {
    timestamps: true,
  }
);

if (mongoose.models.PosScheduleConfig) {
  delete mongoose.models.PosScheduleConfig;
}

export default mongoose.model("PosScheduleConfig", posScheduleConfigSchema);
