import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import PosReceptionist from "@/models/PosReceptionist";
import PosStaff from "@/models/PosStaff";
import PosAccountant from "@/models/PosAccountant";
import PosLoginAudit from "@/models/PosLoginAudit";
import { recordAccountantActivity } from "@/libs/posAccountantActivity";
import { seedPosReceptionistsIfEmpty, seedPosStaffIfEmpty, seedPosAccountantIfEmpty, syncReceptionistLoginCodes } from "@/libs/posSeed";
import { syncStaffLoginCodes } from "@/libs/posStaffServices";
import { getScheduleConfig } from "@/libs/posScheduleConfig";
import { openCashSessionForReceptionist } from "@/libs/posCashRegister";
import { mapCashSessionDoc } from "@/libs/posMappers";

export const dynamic = "force-dynamic";

async function logLoginAttempt({ role, userId, userName, success, isMaster }) {
  try {
    return await PosLoginAudit.create({
      role,
      userId: userId || "",
      userName: userName || "",
      success,
      isMaster,
    });
  } catch (error) {
    console.error("PosLoginAudit", error);
    return null;
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
    await seedPosAccountantIfEmpty();
    await syncStaffLoginCodes();
    await syncReceptionistLoginCodes();

    const scheduleConfig = await getScheduleConfig();
    const masterLoginCode = scheduleConfig.masterLoginCode || "0000";
    const isMaster = pin === masterLoginCode;

    if (role === "admin") {
      if (!isMaster) {
        await logLoginAttempt({
          role: "admin",
          userId: "ADM",
          userName: "Administrador",
          success: false,
          isMaster: false,
        });

        return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
      }

      const receptionist =
        (await PosReceptionist.findOne({ receptionistCode: userId })) ||
        (await PosReceptionist.findOne().sort({ receptionistCode: 1 }));

      if (!receptionist) {
        return NextResponse.json(
          { error: "No hay recepcionistas configuradas para la sesión de administrador" },
          { status: 404 }
        );
      }

      await logLoginAttempt({
        role: "master",
        userId: receptionist.receptionistCode,
        userName: "Administrador",
        success: true,
        isMaster: true,
      });

      return NextResponse.json({
        success: true,
        role: "reception",
        userId: receptionist.receptionistCode,
        userName: "Administrador",
        isMaster: true,
      });
    }

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

      if (pin !== receptionist.loginCode) {
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
        role: "reception",
        userId,
        userName: receptionist.name,
        success: true,
        isMaster: false,
      });

      const openingFloat = Number(body?.openingFloat ?? 0);
      let cashSession = null;
      let cashSessionOpened = false;

      try {
        const result = await openCashSessionForReceptionist({
          receptionistId: receptionist.receptionistCode,
          receptionistName: receptionist.name,
          isMaster,
          openingFloat,
        });
        cashSession = mapCashSessionDoc(result.session);
        cashSessionOpened = result.created;
      } catch (cashError) {
        console.error("Auto-open cash session on reception login", cashError);
      }

      return NextResponse.json({
        success: true,
        role: "reception",
        userId: receptionist.receptionistCode,
        userName: receptionist.name,
        isMaster: false,
        cashSession,
        cashSessionOpened,
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

      if (staff.isActive === false) {
        return NextResponse.json(
          { error: "Esta manicurista ya no está activa en el equipo" },
          { status: 403 }
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

    if (role === "accountant") {
      const accountant = await PosAccountant.findOne({
        accountantCode: userId,
        isActive: { $ne: false },
      });

      if (!accountant) {
        return NextResponse.json(
          { error: "Contadora no encontrada" },
          { status: 404 }
        );
      }

      if (pin !== accountant.loginCode && !isMaster) {
        await logLoginAttempt({
          role: "accountant",
          userId,
          userName: accountant.name,
          success: false,
          isMaster: false,
        });

        return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
      }

      const loginAudit = await logLoginAttempt({
        role: isMaster ? "master" : "accountant",
        userId,
        userName: accountant.name,
        success: true,
        isMaster,
      });

      try {
        await recordAccountantActivity({
          accountantId: accountant.accountantCode,
          action: "login",
          loginAuditId: loginAudit?._id?.toString() || "",
          isMasterSession: isMaster,
        });
      } catch (activityError) {
        console.error("recordAccountantActivity login", activityError);
      }

      return NextResponse.json({
        success: true,
        role: "accountant",
        userId: accountant.accountantCode,
        userName: accountant.name,
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
