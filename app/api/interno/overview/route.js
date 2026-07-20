import { NextResponse } from "next/server";
import { requireInternoSession } from "@/libs/internoAuth";
import {
  formatMongoErrorForUser,
  tryConnectMongo,
} from "@/libs/internoMasterPin";
import {
  FLOW_STEPS,
  MONGO_COLLECTIONS,
  MONGO_DERIVED_FEATURES,
  MONGO_GLOBAL_CONVENTIONS,
  MONGO_RELATIONSHIPS,
  maskDocument,
} from "@/libs/mongoSchemaCatalog";
import PosClient from "@/models/PosClient";
import PosStaff from "@/models/PosStaff";
import PosReceptionist from "@/models/PosReceptionist";
import PosService from "@/models/PosService";
import PosAppointment from "@/models/PosAppointment";
import PosBlockedSlot from "@/models/PosBlockedSlot";
import PosPayment from "@/models/PosPayment";
import PosCashTicket from "@/models/PosCashTicket";
import PosGiftCard from "@/models/PosGiftCard";
import PosCashSession from "@/models/PosCashSession";
import PosLoginAudit from "@/models/PosLoginAudit";
import PosAccountant from "@/models/PosAccountant";
import PosAccountantActivity from "@/models/PosAccountantActivity";
import PosStaffSettlement from "@/models/PosStaffSettlement";
import PosDailySnapshot from "@/models/PosDailySnapshot";
import PosWeeklySnapshot from "@/models/PosWeeklySnapshot";
import PosScheduleConfig from "@/models/PosScheduleConfig";
import PosExpenseCategory from "@/models/PosExpenseCategory";
import PosExpense from "@/models/PosExpense";
import PosSupplier from "@/models/PosSupplier";
import PosInventoryCategory from "@/models/PosInventoryCategory";
import PosInventoryItem from "@/models/PosInventoryItem";
import PosPurchase from "@/models/PosPurchase";
import PosPayable from "@/models/PosPayable";
import User from "@/models/User";
import Lead from "@/models/Lead";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";

export const dynamic = "force-dynamic";

const MODEL_MAP = {
  PosClient,
  PosStaff,
  PosReceptionist,
  PosService,
  PosAppointment,
  PosBlockedSlot,
  PosPayment,
  PosCashTicket,
  PosGiftCard,
  PosCashSession,
  PosLoginAudit,
  PosAccountant,
  PosAccountantActivity,
  PosStaffSettlement,
  PosDailySnapshot,
  PosWeeklySnapshot,
  PosScheduleConfig,
  PosExpenseCategory,
  PosExpense,
  PosSupplier,
  PosInventoryCategory,
  PosInventoryItem,
  PosPurchase,
  PosPayable,
  User,
  Lead,
};

function leanDoc(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  const { __v, ...rest } = obj;
  return rest;
}

export async function GET() {
  try {
    const auth = await requireInternoSession();
    if (auth.error) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const dbName =
      process.env.MONGODB_URI?.split("/").pop()?.split("?")[0] || "studio_ae";

    const catalogModels = new Set(MONGO_COLLECTIONS.map((entry) => entry.model));
    const registeredModels = Object.keys(MODEL_MAP);
    const missingFromCatalog = registeredModels.filter((name) => !catalogModels.has(name));
    const missingFromRegistry = [...catalogModels].filter((name) => !MODEL_MAP[name]);

    const staticPayload = {
      database: dbName,
      generatedAt: new Date().toISOString(),
      collections: MONGO_COLLECTIONS,
      relationships: MONGO_RELATIONSHIPS,
      derivedFeatures: MONGO_DERIVED_FEATURES,
      globalConventions: MONGO_GLOBAL_CONVENTIONS,
      flows: FLOW_STEPS,
      catalogStats: {
        documentedCollections: MONGO_COLLECTIONS.length,
        liveCountModels: registeredModels.length,
        missingFromCatalog,
        missingFromRegistry,
      },
    };

    const mongo = await tryConnectMongo();
    if (!mongo.ok) {
      return NextResponse.json({
        ...staticPayload,
        mongoOffline: true,
        mongoError: formatMongoErrorForUser(mongo.error),
        counts: {},
        samples: {},
        live: {
          openCashSession: null,
          appointmentsOnOpenShiftDate: 0,
          latestWeeklySnapshot: null,
        },
      });
    }

    const counts = {};
    const samples = {};
    await Promise.all(
      Object.entries(MODEL_MAP).map(async ([name, Model]) => {
        counts[name] = await Model.countDocuments();

        const recent = await Model.find()
          .sort({ updatedAt: -1, createdAt: -1 })
          .limit(2)
          .lean();

        samples[name] = recent.map((doc) => maskDocument(leanDoc(doc)));
      })
    );

    const openCashSession = await PosCashSession.findOne({ status: "open" })
      .sort({ createdAt: -1 })
      .lean();

    const shiftDate =
      openCashSession?.shiftDate || getTodaySpanishShortDate();

    const todayAppointments = await PosAppointment.countDocuments({
      date: shiftDate,
    });

    const latestWeeklySnapshot = await PosWeeklySnapshot.findOne()
      .sort({ weekStartDate: -1, updatedAt: -1 })
      .lean();

    return NextResponse.json({
      ...staticPayload,
      mongoOffline: false,
      counts,
      samples,
      live: {
        openCashSession: openCashSession
          ? maskDocument(leanDoc(openCashSession))
          : null,
        appointmentsOnOpenShiftDate: todayAppointments,
        latestWeeklySnapshot: latestWeeklySnapshot
          ? maskDocument(leanDoc(latestWeeklySnapshot))
          : null,
      },
    });
  } catch (error) {
    console.error("GET /api/interno/overview", error);
    return NextResponse.json(
      { error: formatMongoErrorForUser(error) },
      { status: 500 }
    );
  }
}
