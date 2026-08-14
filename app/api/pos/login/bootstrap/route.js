import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import PosReceptionist from "@/models/PosReceptionist";
import PosStaff from "@/models/PosStaff";
import PosAccountant from "@/models/PosAccountant";
import PosMarketingAgency from "@/models/PosMarketingAgency";
import {
  seedPosReceptionistsIfEmpty,
  seedPosStaffIfEmpty,
  seedPosAccountantIfEmpty,
  seedPosMarketingAgencyIfEmpty,
  syncReceptionistLoginCodes,
} from "@/libs/posSeed";
import {
  syncStaffAllowedServices,
  syncStaffLoginCodes,
} from "@/libs/posStaffServices";
import { ACTIVE_STAFF_FILTER } from "@/libs/posStaffQuery";

export const dynamic = "force-dynamic";

function mapPublicReceptionist(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.receptionistCode,
    name: raw.name,
    role: raw.role || "Recepción",
    bookingsToday: raw.bookingsToday ?? 0,
    bookingsTodayDate: raw.bookingsTodayDate || "",
    image: raw.image || "",
    color: raw.color,
    colorLight: raw.colorLight,
  };
}

function mapPublicStaff(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.staffCode,
    name: raw.name,
    role: raw.role,
    status: raw.status,
    image: raw.image || "",
    color: raw.color,
    colorLight: raw.colorLight,
  };
}

function mapPublicAccountant(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.accountantCode,
    name: raw.name,
    role: raw.role || "Contabilidad",
  };
}

function mapPublicMarketingAgency(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;

  return {
    id: raw.agencyCode,
    name: raw.name,
    role: raw.role || "Mercadotecnia",
  };
}

export async function GET() {
  try {
    await connectMongo();
    await seedPosReceptionistsIfEmpty();
    await seedPosStaffIfEmpty();
    await seedPosAccountantIfEmpty();
    await seedPosMarketingAgencyIfEmpty();
    await syncStaffAllowedServices();
    await syncStaffLoginCodes();
    await syncReceptionistLoginCodes();

    const [receptionists, staff, accountants, marketingAgencies] = await Promise.all([
      PosReceptionist.find().sort({ name: 1 }),
      PosStaff.find(ACTIVE_STAFF_FILTER).sort({ name: 1 }),
      PosAccountant.find({ isActive: { $ne: false } }).sort({ name: 1 }),
      PosMarketingAgency.find({ isActive: { $ne: false } }).sort({ name: 1 }),
    ]);

    return NextResponse.json({
      receptionists: receptionists.map(mapPublicReceptionist),
      staff: staff.map(mapPublicStaff),
      accountants: accountants.map(mapPublicAccountant),
      marketingAgencies: marketingAgencies.map(mapPublicMarketingAgency),
    });
  } catch (error) {
    console.error("GET /api/pos/login/bootstrap", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar el terminal de acceso" },
      { status: 500 }
    );
  }
}
