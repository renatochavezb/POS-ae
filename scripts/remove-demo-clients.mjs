/**
 * Elimina los clientes de demostración de MongoDB.
 * Uso: node scripts/remove-demo-clients.mjs
 */
import dns from "dns";
import mongoose from "mongoose";

dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const DEMO_CLIENT_CODES = ["SA-2022", "SA-4092", "SA-2218"];

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("Falta MONGODB_URI en el entorno.");
  process.exit(1);
}

const posClientSchema = new mongoose.Schema(
  { clientCode: String },
  { strict: false }
);
const PosClient =
  mongoose.models.PosClient || mongoose.model("PosClient", posClientSchema);

const posAppointmentSchema = new mongoose.Schema(
  { clientId: String },
  { strict: false }
);
const PosAppointment =
  mongoose.models.PosAppointment ||
  mongoose.model("PosAppointment", posAppointmentSchema);

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

const appointmentsRemoved = await PosAppointment.deleteMany({
  clientId: { $in: DEMO_CLIENT_CODES },
});

const clientsRemoved = await PosClient.deleteMany({
  clientCode: { $in: DEMO_CLIENT_CODES },
});

console.log(`Citas de demo eliminadas: ${appointmentsRemoved.deletedCount}`);
console.log(`Clientes de demo eliminados: ${clientsRemoved.deletedCount}`);

await mongoose.disconnect();
