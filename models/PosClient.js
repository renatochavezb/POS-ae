import mongoose from "mongoose";

const styleProfileSchema = mongoose.Schema(
  {
    bio: { type: String, default: "" },
    tags: { type: [String], default: [] },
  },
  { _id: false }
);

const crmSegmentFlagsSchema = mongoose.Schema(
  {
    inactive: { type: Boolean, default: false },
    upcoming: { type: Boolean, default: false },
    unconfirmed: { type: Boolean, default: false },
    nuevas: { type: Boolean, default: false },
    birthday: { type: Boolean, default: false },
    alerts: { type: Boolean, default: false },
    reschedule: { type: Boolean, default: false },
  },
  { _id: false }
);

const posClientSchema = mongoose.Schema(
  {
    clientCode: {
      type: String,
      required: true,
      unique: true,
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
    birthday: {
      type: String,
      default: "No especificado",
      trim: true,
    },
    address: {
      type: String,
      default: "No especificada",
      trim: true,
    },
    isPlatinum: {
      type: Boolean,
      default: false,
    },
    memberSince: {
      type: String,
      default: "",
      trim: true,
    },
    bio: {
      type: String,
      default: "",
    },
    styleProfile: {
      type: styleProfileSchema,
      default: () => ({ bio: "", tags: [] }),
    },
    alerts: {
      type: [String],
      default: [],
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    visitsCount: {
      type: Number,
      default: 0,
    },
    averageTicket: {
      type: Number,
      default: 0,
    },
    registeredAt: {
      type: Date,
      default: null,
    },
    lastPaidVisitDate: {
      type: String,
      default: "",
      trim: true,
    },
    phoneNormalized: {
      type: String,
      trim: true,
    },
    emailNormalized: {
      type: String,
      trim: true,
    },
    crmSegmentFlags: {
      type: crmSegmentFlagsSchema,
      default: () => ({}),
    },
    crmSegmentDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    crmSegmentsSyncedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

posClientSchema.index({ phoneNormalized: 1 }, { unique: true, sparse: true });
posClientSchema.index({ emailNormalized: 1 }, { unique: true, sparse: true });
posClientSchema.index({ "crmSegmentFlags.inactive": 1 });
posClientSchema.index({ "crmSegmentFlags.upcoming": 1 });
posClientSchema.index({ "crmSegmentFlags.unconfirmed": 1 });
posClientSchema.index({ "crmSegmentFlags.nuevas": 1 });
posClientSchema.index({ "crmSegmentFlags.birthday": 1 });
posClientSchema.index({ "crmSegmentFlags.alerts": 1 });
posClientSchema.index({ "crmSegmentFlags.reschedule": 1 });

export default mongoose.models?.PosClient ||
  mongoose.model("PosClient", posClientSchema);
