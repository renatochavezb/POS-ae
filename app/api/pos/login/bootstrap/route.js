import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import PosReceptionist from "@/models/PosReceptionist";
import PosStaff from "@/models/PosStaff";
import {
  seedPosReceptionistsIfEmpty,
  seedPosStaffIfEmpty,
} from "@/libs/posSeed";
import {
  syncStaffAllowedServices,
  syncStaffLoginCodes,
} from "@/libs/posStaffServices";

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

export async function GET() {
  try {
    await connectMongo();
    await seedPosReceptionistsIfEmpty();
    await seedPosStaffIfEmpty();
    await syncStaffAllowedServices();
    await syncStaffLoginCodes();

    const [receptionists, staff] = await Promise.all([
      PosReceptionist.find().sort({ name: 1 }),
      PosStaff.find().sort({ name: 1 }),
    ]);

    return NextResponse.json({
      receptionists: receptionists.map(mapPublicReceptionist),
      staff: staff.map(mapPublicStaff),
    });
  } catch (error) {
    console.error("GET /api/pos/login/bootstrap", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar el terminal de acceso" },
      { status: 500 }
    );
  }
}
