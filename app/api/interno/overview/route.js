import { NextResponse } from "next/server";
import { requireInternoSession } from "@/libs/internoAuth";
import {
  formatMongoErrorForUser,
  tryConnectMongo,
} from "@/libs/internoMasterPin";import {
  FLOW_STEPS,
  MONGO_COLLECTIONS,
  MONGO_RELATIONSHIPS,
  maskDocument,
} from "@/libs/mongoSchemaCatalog";
import PosClient from "@/models/PosClient";
import PosStaff from "@/models/PosStaff";
import PosReceptionist from "@/models/PosReceptionist";
import PosAppointment from "@/models/PosAppointment";
import PosBlockedSlot from "@/models/PosBlockedSlot";
import PosPayment from "@/models/PosPayment";
import PosCashSession from "@/models/PosCashSession";
import PosLoginAudit from "@/models/PosLoginAudit";
import PosDailySnapshot from "@/models/PosDailySnapshot";
import PosScheduleConfig from "@/models/PosScheduleConfig";
import User from "@/models/User";
import Lead from "@/models/Lead";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";

export const dynamic = "force-dynamic";

const MODEL_MAP = {
  PosClient,
  PosStaff,
  PosReceptionist,
  PosAppointment,
  PosBlockedSlot,
  PosPayment,
  PosCashSession,
  PosLoginAudit,
  PosDailySnapshot,
  PosScheduleConfig,
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

    const staticPayload = {
      database: dbName,
      generatedAt: new Date().toISOString(),
      collections: MONGO_COLLECTIONS,
      relationships: MONGO_RELATIONSHIPS,
      flows: FLOW_STEPS,
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