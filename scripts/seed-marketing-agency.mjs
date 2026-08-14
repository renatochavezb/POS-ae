import dns from "dns";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_DIRECT;
if (!uri) {
  console.error("Falta MONGODB_URI en .env.local");
  process.exit(1);
}

const schema = new mongoose.Schema(
  {
    agencyCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    role: { type: String, default: "Mercadotecnia", trim: true },
    loginCode: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Model =
  mongoose.models.PosMarketingAgency ||
  mongoose.model("PosMarketingAgency", schema);

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

await Model.updateOne(
  { agencyCode: "AG" },
  {
    $set: {
      name: "Agencia",
      role: "Mercadotecnia",
      loginCode: "6291",
      email: "agencia@ae.studioo",
      phone: "",
      isActive: true,
    },
  },
  { upsert: true }
);

const rows = await Model.find().lean();
console.log(
  JSON.stringify(
    rows.map((r) => ({
      agencyCode: r.agencyCode,
      name: r.name,
      loginCode: r.loginCode,
      isActive: r.isActive,
    })),
    null,
    2
  )
);

await mongoose.disconnect();
