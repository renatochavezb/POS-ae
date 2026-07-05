import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapStaffDoc } from "@/libs/posMappers";
import { seedPosStaffIfEmpty, syncStaffLocalImages } from "@/libs/posSeed";
import {
  syncStaffAllowedServices,
  resolveAllowedServiceIdsForNewStaff,
} from "@/libs/posStaffServices";
import PosStaff from "@/models/PosStaff";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();
    await seedPosStaffIfEmpty();
    await syncStaffLocalImages();
    await syncStaffAllowedServices();

    const staff = await PosStaff.find().sort({ name: 1 });
    return NextResponse.json(staff.map(mapStaffDoc));
  } catch (error) {
    console.error("GET /api/pos/staff", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar el equipo" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const body = await req.json();

    if (!body?.name || !body?.role || !body?.staffCode) {
      return NextResponse.json(
        { error: "Nombre, rol y código de staff son obligatorios" },
        { status: 400 }
      );
    }

    await connectMongo();

    const staffCode = String(body.staffCode).trim().toUpperCase();
    const existing = await PosStaff.findOne({ staffCode });

    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una manicurista con ese código" },
        { status: 409 }
      );
    }

    const created = await PosStaff.create({
      staffCode,
      name: body.name,
      email: body.email || "",
      phone: body.phone || "",
      role: body.role,
      status: body.status || "online",
      rating: body.rating ?? 5,
      specialty: body.specialty || "",
      shift: body.shift || "Completo",
      completedToday: body.completedToday ?? 0,
      totalToday: body.totalToday ?? 0,
      weeklyRevenue: body.weeklyRevenue ?? 0,
      commissionPercent: body.commissionPercent ?? 40,
      bio: body.bio || "",
      image: body.image || "",
      color: body.color,
      colorLight: body.colorLight,
      allowedServiceIds: resolveAllowedServiceIdsForNewStaff(body),
      loginCode: body.loginCode || "1234",
    });

    return NextResponse.json(mapStaffDoc(created), { status: 201 });
  } catch (error) {
    console.error("POST /api/pos/staff", error);
    return NextResponse.json(
      { error: error.message || "No se pudo dar de alta a la manicurista" },
      { status: 500 }
    );
  }
}
