import mongoose from "mongoose";

const posAppointmentSchema = mongoose.Schema(
  {
    appointmentCode: {
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
    time: {
      type: String,
      required: true,
      trim: true,
    },
    serviceName: {
      type: String,
      required: true,
      trim: true,
    },
    serviceSubtitle: {
      type: String,
      default: "",
      trim: true,
    },
    serviceImage: {
      type: String,
      default: "",
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    clientId: {
      type: String,
      required: true,
      trim: true,
    },
    staffId: {
      type: String,
      required: true,
      trim: true,
    },
    staffName: {
      type: String,
      required: true,
      trim: true,
    },
    staffInitials: {
      type: String,
      required: true,
      trim: true,
    },
    cost: {
      type: Number,
      default: 0,
    },
    duration: {
      type: Number,
      default: 60,
    },
    status: {
      type: String,
      enum: [
        "agendado",
        "confirmado",
        "pagado",
        "cancelled",
        "pending",
        "completed",
      ],
      default: "agendado",
    },
    bookedByReceptionistId: {
      type: String,
      default: "",
      trim: true,
    },
    bookedByReceptionistName: {
      type: String,
      default: "",
      trim: true,
    },
    bookedOnDate: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

posAppointmentSchema.index({ date: 1, staffId: 1, time: 1 });
posAppointmentSchema.index({ bookedByReceptionistId: 1, bookedOnDate: 1 });

// Evita esquema obsoleto en caché (Next.js hot reload).
if (mongoose.models.PosAppointment) {
  delete mongoose.models.PosAppointment;
}

export default mongoose.model("PosAppointment", posAppointmentSchema);
