/**
 * Elimina citas, pagos, cortes de caja y datos relacionados de fechas específicas.
 * Conserva clientas (PosClient).
 *
 * Uso: node scripts/purge-pos-days.mjs
 */
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

/** Domingo 12 de julio 2026 (pruebas). */
const TARGET_DATES = ["12 Jul, 2026"];
const TARGET_YMD = ["2026-07-12"];

const uri =
  process.env.MONGODB_URI ||
  process.env.MONGODB_URI_DIRECT;

if (!uri) {
  console.error("Falta MONGODB_URI en .env.local");
  process.exit(1);
}

const schema = { strict: false };
const PosAppointment = mongoose.model(
  "PosAppointment",
  new mongoose.Schema({}, schema),
  "posappointments"
);
const PosPayment = mongoose.model(
  "PosPayment",
  new mongoose.Schema({}, schema),
  "pospayments"
);
const PosCashSession = mongoose.model(
  "PosCashSession",
  new mongoose.Schema({}, schema),
  "poscashsessions"
);
const PosBlockedSlot = mongoose.model(
  "PosBlockedSlot",
  new mongoose.Schema({}, schema),
  "posblockedslots"
);
const PosDailySnapshot = mongoose.model(
  "PosDailySnapshot",
  new mongoose.Schema({}, schema),
  "posdailysnapshots"
);
const PosLoginAudit = mongoose.model(
  "PosLoginAudit",
  new mongoose.Schema({}, schema),
  "posloginaudits"
);
const PosStaffSettlement = mongoose.model(
  "PosStaffSettlement",
  new mongoose.Schema({}, schema),
  "posstaffsettlements"
);
const PosAccountantActivity = mongoose.model(
  "PosAccountantActivity",
  new mongoose.Schema({}, schema),
  "posaccountantactivities"
);
const PosClient = mongoose.model(
  "PosClient",
  new mongoose.Schema({}, schema),
  "posclients"
);
const PosStaff = mongoose.model(
  "PosStaff",
  new mongoose.Schema({}, schema),
  "posstaffs"
);
const PosCashTicket = mongoose.model(
  "PosCashTicket",
  new mongoose.Schema({}, schema),
  "poscashtickets"
);
const PosReceptionist = mongoose.model(
  "PosReceptionist",
  new mongoose.Schema({}, schema),
  "posreceptionists"
);

function compareSpanishDates(a, b) {
  const parse = (label) => {
    const match = String(label).match(/^(\d{1,2})\s+(\w+),?\s*(\d{4})$/i);
    if (!match) return null;
    const months = {
      ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
      jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
    };
    const month = months[match[2].slice(0, 3).toLowerCase()];
    if (month === undefined) return null;
    return new Date(Number(match[3]), month, Number(match[1]));
  };
  const da = parse(a);
  const db = parse(b);
  if (!da || !db) return 0;
  return da.getTime() - db.getTime();
}

async function recalcClientStats(clientCodes) {
  for (const clientCode of clientCodes) {
    const payments = await PosPayment.find({ clientId: clientCode }).lean();
    const visitsCount = payments.length;
    const totalSpent = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    let lastPaidVisitDate = "";

    for (const payment of payments) {
      if (
        !lastPaidVisitDate ||
        compareSpanishDates(payment.appointmentDate, lastPaidVisitDate) > 0
      ) {
        lastPaidVisitDate = payment.appointmentDate;
      }
    }

    await PosClient.updateOne(
      { clientCode },
      {
        $set: {
          visitsCount,
          totalSpent,
          averageTicket: visitsCount > 0 ? totalSpent / visitsCount : 0,
          lastPaidVisitDate,
        },
      }
    );
  }
}

async function recalcReceptionistBookingsToday() {
  const operationalToday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(new Date())
    .replace(/^(\w+)\s(\d+),\s(\d+)$/, (_, month, day, year) => {
      const map = {
        Jan: "Ene",
        Feb: "Feb",
        Mar: "Mar",
        Apr: "Abr",
        May: "May",
        Jun: "Jun",
        Jul: "Jul",
        Aug: "Ago",
        Sep: "Sep",
        Oct: "Oct",
        Nov: "Nov",
        Dec: "Dic",
      };
      return `${day} ${map[month] ?? month}, ${year}`;
    });

  const receptionists = await PosReceptionist.find().lean();
  for (const receptionist of receptionists) {
    const count = await PosAppointment.countDocuments({
      bookedByReceptionistId: receptionist.receptionistCode,
      bookedOnDate: operationalToday,
      status: { $ne: "cancelled" },
    });
    await PosReceptionist.updateOne(
      { receptionistCode: receptionist.receptionistCode },
      {
        $set: {
          bookingsToday: count,
          bookingsTodayDate: operationalToday,
        },
      }
    );
  }
}

async function recalcStaffWeeklyRevenue() {
  const staffList = await PosStaff.find().lean();
  const payments = await PosPayment.find().lean();

  for (const staff of staffList) {
    const revenue = payments
      .filter((p) => p.staffId === staff.staffCode)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    await PosStaff.updateOne(
      { staffCode: staff.staffCode },
      { $set: { weeklyRevenue: revenue } }
    );
  }
}

console.log("Conectando a MongoDB...");
await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
console.log("Conectado.\n");

const appointments = await PosAppointment.find({
  date: { $in: TARGET_DATES },
}).lean();

const appointmentCodes = appointments.map((a) => a.appointmentCode).filter(Boolean);
const affectedClientIds = [
  ...new Set(appointments.map((a) => a.clientId).filter(Boolean)),
];

console.log(`Citas encontradas (${TARGET_DATES.join(" / ")}): ${appointments.length}`);

const payments = await PosPayment.find({
  $or: [
    { appointmentDate: { $in: TARGET_DATES } },
    { appointmentCode: { $in: appointmentCodes } },
  ],
}).lean();

const paymentCodes = payments.map((p) => p.paymentCode).filter(Boolean);
console.log(`Pagos relacionados: ${payments.length}`);

const cashSessions = await PosCashSession.find({
  shiftDate: { $in: TARGET_DATES },
}).lean();

const cashSessionCodes = cashSessions.map((s) => s.sessionCode).filter(Boolean);
console.log(`Cortes de caja: ${cashSessions.length}`);

const cashTickets = await PosCashTicket.find({
  $or: [
    { appointmentDate: { $in: TARGET_DATES } },
    { appointmentCode: { $in: appointmentCodes } },
  ],
}).lean();
console.log(`Fichas de caja: ${cashTickets.length}`);

const loginAudits = await PosLoginAudit.deleteMany({
  cashSessionCode: { $in: cashSessionCodes },
});

const accountantActivities = await PosAccountantActivity.deleteMany({
  $or: [
    { periodStartYmd: { $in: TARGET_YMD } },
    { periodEndYmd: { $in: TARGET_YMD } },
    {
      periodStartYmd: { $lte: "2026-07-12" },
      periodEndYmd: { $gte: "2026-07-12" },
    },
    { appointmentCodes: { $in: appointmentCodes } },
    { paymentCodes: { $in: paymentCodes } },
    { cashSessionCodes: { $in: cashSessionCodes } },
  ],
});

const settlements = await PosStaffSettlement.deleteMany({
  $or: [
    { periodStartYmd: { $in: TARGET_YMD } },
    { periodEndYmd: { $in: TARGET_YMD } },
    {
      periodStartYmd: { $lte: "2026-07-12" },
      periodEndYmd: { $gte: "2026-07-12" },
    },
    { appointmentCodes: { $in: appointmentCodes } },
    { paymentCodes: { $in: paymentCodes } },
    { cashSessionCodes: { $in: cashSessionCodes } },
  ],
});

const paymentsRemoved = await PosPayment.deleteMany({
  $or: [
    { appointmentDate: { $in: TARGET_DATES } },
    { appointmentCode: { $in: appointmentCodes } },
    { paymentCode: { $in: paymentCodes } },
  ],
});

const appointmentsRemoved = await PosAppointment.deleteMany({
  date: { $in: TARGET_DATES },
});

const cashSessionsRemoved = await PosCashSession.deleteMany({
  shiftDate: { $in: TARGET_DATES },
});

const blockedRemoved = await PosBlockedSlot.deleteMany({
  date: { $in: TARGET_DATES },
});

const snapshotsRemoved = await PosDailySnapshot.deleteMany({
  date: { $in: TARGET_DATES },
});

const cashTicketsRemoved = await PosCashTicket.deleteMany({
  $or: [
    { appointmentDate: { $in: TARGET_DATES } },
    { appointmentCode: { $in: appointmentCodes } },
  ],
});

console.log("\n--- Resumen ---");
console.log(`Auditoría caja eliminada: ${loginAudits.deletedCount}`);
console.log(`Actividad contadora eliminada: ${accountantActivities.deletedCount}`);
console.log(`Liquidaciones eliminadas: ${settlements.deletedCount}`);
console.log(`Pagos eliminados: ${paymentsRemoved.deletedCount}`);
console.log(`Citas eliminadas: ${appointmentsRemoved.deletedCount}`);
console.log(`Cortes de caja eliminados: ${cashSessionsRemoved.deletedCount}`);
console.log(`Bloqueos eliminados: ${blockedRemoved.deletedCount}`);
console.log(`Snapshots diarios eliminados: ${snapshotsRemoved.deletedCount}`);
console.log(`Fichas de caja eliminadas: ${cashTicketsRemoved.deletedCount}`);

if (affectedClientIds.length > 0) {
  console.log(`\nRecalculando stats de ${affectedClientIds.length} clientas...`);
  await recalcClientStats(affectedClientIds);
}

console.log("Recalculando contadores de recepción...");
await recalcReceptionistBookingsToday();

console.log("Recalculando ingresos semanales de manicuristas...");
await recalcStaffWeeklyRevenue();

console.log("\nClientas conservadas. Limpieza completada.");
await mongoose.disconnect();
