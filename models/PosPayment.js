import mongoose from "mongoose";

const posPaymentSchema = mongoose.Schema(
  {
    paymentCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    transactionType: {
      type: String,
      enum: ["appointment", "gift_card_sale"],
      default: "appointment",
    },
    giftCardCode: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
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
    ticketCode: {
      type: String,
      default: "",
      trim: true,
    },
    serviceName: {
      type: String,
      default: "",
      trim: true,
    },
    serviceLines: {
      type: [
        {
          serviceId: { type: String, default: "", trim: true },
          name: { type: String, required: true, trim: true },
          price: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    /** Importe del servicio antes de descuento/garantía. */
    serviceGross: {
      type: Number,
      default: 0,
      min: 0,
    },
    tip: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    /**
     * Reparto del descuento entre responsables (manicurista / recepción).
     * percent = % del importe del servicio; amount = pesos a descontar de su comisión.
     */
    discountSplits: {
      type: [
        {
          role: { type: String, enum: ["staff", "receptionist"], required: true },
          id: { type: String, default: "", trim: true },
          name: { type: String, default: "", trim: true },
          percent: { type: Number, default: 0, min: 0 },
          amount: { type: Number, default: 0, min: 0 },
        },
      ],
      default: [],
    },
    /** @deprecated Preferir discountSplits; se mantiene por compatibilidad. */
    discountTargetRole: {
      type: String,
      enum: ["", "staff", "receptionist"],
      default: "",
    },
    discountTargetId: {
      type: String,
      default: "",
      trim: true,
    },
    discountTargetName: {
      type: String,
      default: "",
      trim: true,
    },
    /** Motivo del descuento (ej. llegó tarde, error de recepción). */
    discountReason: {
      type: String,
      default: "",
      trim: true,
    },
    isWarranty: {
      type: Boolean,
      default: false,
    },
    /** Manicurista que cometió el error (servicio original). */
    warrantyOriginalStaffId: {
      type: String,
      default: "",
      trim: true,
    },
    warrantyOriginalStaffName: {
      type: String,
      default: "",
      trim: true,
    },
    /** Quién realiza el arreglo de garantía. */
    warrantyPerformedByStaffId: {
      type: String,
      default: "",
      trim: true,
    },
    warrantyPerformedByStaffName: {
      type: String,
      default: "",
      trim: true,
    },
    /** Qué trabajo se vuelve a hacer (todo o parte). */
    warrantyWorkDescription: {
      type: String,
      default: "",
      trim: true,
    },
    /** Monto del trabajo en garantía (servicio completo o parcial). */
    warrantyServiceAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    /**
     * Pesos que se restan de la comisión de la original y se suman a quien
     * terminó la garantía. 0 si es la misma manicurista.
     */
    warrantyTransferAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    warrantySameStaff: {
      type: Boolean,
      default: false,
    },
    /** Cobro de prueba solo desde Registrar cobro (no afecta agenda). */
    isCajaDemo: {
      type: Boolean,
      default: false,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    method: {
      type: String,
      enum: ["efectivo", "tarjeta", "transferencia", "gift_card", "mixto"],
      required: true,
    },
    cashAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    cardAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    transferAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    giftCardAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    cashSessionCode: {
      type: String,
      default: "",
      trim: true,
    },
    processedByReceptionistId: {
      type: String,
      default: "",
      trim: true,
    },
    processedByReceptionistName: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

posPaymentSchema.index({ appointmentCode: 1 });
posPaymentSchema.index({ appointmentDate: 1 });
posPaymentSchema.index({ cashSessionCode: 1 });
posPaymentSchema.index({ createdAt: -1 });

if (mongoose.models.PosPayment) {
  delete mongoose.models.PosPayment;
}

export default mongoose.model("PosPayment", posPaymentSchema);
