import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import PosReceptionist from "@/models/PosReceptionist";
import PosStaff from "@/models/PosStaff";
import PosLoginAudit from "@/models/PosLoginAudit";
import { seedPosReceptionistsIfEmpty, seedPosStaffIfEmpty } from "@/libs/posSeed";
import { syncStaffLoginCodes } from "@/libs/posStaffServices";
import { getScheduleConfig } from "@/libs/posScheduleConfig";

export const dynamic = "force-dynamic";

async function logLoginAttempt({ role, userId, userName, success, isMaster }) {
  try {
    await PosLoginAudit.create({
      role,
      userId: userId || "",
      userName: userName || "",
      success,
      isMaster,
    });
  } catch (error) {
    console.error("PosLoginAudit", error);
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const role = String(body?.role || "").trim();
    const userId = String(body?.userId || "").trim().toUpperCase();
    const pin = String(body?.pin || "").trim();

    if (!role || !userId || pin.length !== 4) {
      return NextResponse.json(
        { error: "Credenciales incompletas" },
        { status: 400 }
      );
    }

    await connectMongo();
    await seedPosReceptionistsIfEmpty();
    await seedPosStaffIfEmpty();
    await syncStaffLoginCodes();

    const scheduleConfig = await getScheduleConfig();
    const masterLoginCode = scheduleConfig.masterLoginCode || "0000";
    const isMaster = pin === masterLoginCode;

    if (role === "reception") {
      const receptionist = await PosReceptionist.findOne({
        receptionistCode: userId,
      });

      if (!receptionist) {
        return NextResponse.json(
          { error: "Recepcionista no encontrada" },
          { status: 404 }
        );
      }

      if (pin !== receptionist.loginCode && !isMaster) {
        await logLoginAttempt({
          role: "reception",
          userId,
          userName: receptionist.name,
          success: false,
          isMaster: false,
        });

        return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
      }

      await logLoginAttempt({
        role: isMaster ? "master" : "reception",
        userId,
        userName: receptionist.name,
        success: true,
        isMaster,
      });

      return NextResponse.json({
        success: true,
        role: "reception",
        userId: receptionist.receptionistCode,
        userName: receptionist.name,
        isMaster,
      });
    }

    if (role === "manicurista") {
      const staff = await PosStaff.findOne({ staffCode: userId });

      if (!staff) {
        return NextResponse.json(
          { error: "Manicurista no encontrada" },
          { status: 404 }
        );
      }

      if (pin !== staff.loginCode && !isMaster) {
        await logLoginAttempt({
          role: "manicurista",
          userId,
          userName: staff.name,
          success: false,
          isMaster: false,
        });

        return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
      }

      await logLoginAttempt({
        role: isMaster ? "master" : "manicurista",
        userId,
        userName: staff.name,
        success: true,
        isMaster,
      });

      return NextResponse.json({
        success: true,
        role: "manicurista",
        userId: staff.staffCode,
        userName: staff.name,
        isMaster,
      });
    }

    return NextResponse.json({ error: "Rol no válido" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/pos/login/verify", error);
    return NextResponse.json(
      { error: error.message || "No se pudo validar el acceso" },
      { status: 500 }
    );
  }
}
