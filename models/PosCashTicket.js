import mongoose from "mongoose";

const cashTicketLineSchema = mongoose.Schema(
  {
    serviceId: {
      type: String,
      default: "",
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const posCashTicketSchema = mongoose.Schema(
  {
    ticketCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    appointmentCode: {
      type: String,
      required: true,
      trim: true,
    },
    appointmentDate: {
      type: String,
      required: true,
      trim: true,
    },
    clientId: {
      type: String,
      default: "",
      trim: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    staffId: {
      type: String,
      default: "",
      trim: true,
    },
    staffName: {
      type: String,
      default: "",
      trim: true,
    },
    lines: {
      type: [cashTicketLineSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["submitted", "charged", "cancelled"],
      default: "submitted",
    },
    submittedByStaffId: {
      type: String,
      default: "",
      trim: true,
    },
    submittedByStaffName: {
      type: String,
      default: "",
      trim: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    chargedAt: {
      type: Date,
      default: null,
    },
    paymentCode: {
      type: String,
      default: "",
      trim: true,
    },
    workPhotos: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

posCashTicketSchema.index({ appointmentCode: 1, status: 1 });
posCashTicketSchema.index({ appointmentDate: 1, status: 1 });
posCashTicketSchema.index({ staffId: 1, appointmentDate: 1, status: 1 });

if (mongoose.models.PosCashTicket) {
  delete mongoose.models.PosCashTicket;
}

export default mongoose.model("PosCashTicket", posCashTicketSchema);
