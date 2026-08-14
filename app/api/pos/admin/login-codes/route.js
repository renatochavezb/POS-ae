import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession, requireMasterSession } from "@/libs/posAuth";
import { getScheduleConfig } from "@/libs/posScheduleConfig";
import { ACTIVE_STAFF_FILTER } from "@/libs/posStaffQuery";
import PosStaff from "@/models/PosStaff";
import PosReceptionist from "@/models/PosReceptionist";
import PosAccountant from "@/models/PosAccountant";
import PosMarketingAgency from "@/models/PosMarketingAgency";
import PosScheduleConfig from "@/models/PosScheduleConfig";

export const dynamic = "force-dynamic";

const VALID_ROLES = new Set(["staff", "reception", "accountant", "marketing", "master"]);

function isValidPin(value) {
  return /^\d{4}$/.test(String(value || "").trim());
}

function mapStaffRow(doc) {
  return {
    role: "staff",
    id: doc.staffCode,
    name: doc.name,
    subtitle: doc.role || "Manicurista",
    loginCode: String(doc.loginCode || "").trim(),
    isActive: doc.isActive !== false,
  };
}

function mapReceptionRow(doc) {
  return {
    role: "reception",
    id: doc.receptionistCode,
    name: doc.name,
    subtitle: doc.role || "Recepción",
    loginCode: String(doc.loginCode || "").trim(),
    isActive: true,
  };
}

function mapAccountantRow(doc) {
  return {
    role: "accountant",
    id: doc.accountantCode,
    name: doc.name,
    subtitle: doc.role || "Contabilidad",
    loginCode: String(doc.loginCode || "").trim(),
    isActive: doc.isActive !== false,
  };
}

function mapMarketingRow(doc) {
  return {
    role: "marketing",
    id: doc.agencyCode,
    name: doc.name,
    subtitle: doc.role || "Mercadotecnia",
    loginCode: String(doc.loginCode || "").trim(),
    isActive: doc.isActive !== false,
  };
}

export async function GET(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const master = requireMasterSession(req);
    if (master.error) {
      return NextResponse.json(
        { error: "Solo el administrador puede consultar las claves del personal" },
        { status: 403 }
      );
    }

    await connectMongo();

    const [staff, receptionists, accountants, marketingAgencies, schedule] =
      await Promise.all([
        PosStaff.find(ACTIVE_STAFF_FILTER).sort({ name: 1 }),
        PosReceptionist.find().sort({ name: 1 }),
        PosAccountant.find({ isActive: { $ne: false } }).sort({ name: 1 }),
        PosMarketingAgency.find({ isActive: { $ne: false } }).sort({ name: 1 }),
        getScheduleConfig(),
      ]);

    return NextResponse.json({
      staff: staff.map(mapStaffRow),
      receptionists: receptionists.map(mapReceptionRow),
      accountants: accountants.map(mapAccountantRow),
      marketingAgencies: marketingAgencies.map(mapMarketingRow),
      master: {
        role: "master",
        id: "MASTER",
        name: "Administrador",
        subtitle: "PIN maestro",
        loginCode: String(schedule.masterLoginCode || "0000").trim(),
        isActive: true,
      },
    });
  } catch (error) {
    console.error("GET /api/pos/admin/login-codes", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar las claves" },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const master = requireMasterSession(req);
    if (master.error) {
      return NextResponse.json(
        { error: "Solo el administrador puede modificar las claves del personal" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const adminPin = String(body?.adminPin || "").trim();
    const updates = Array.isArray(body?.updates) ? body.updates : [];

    if (!isValidPin(adminPin)) {
      return NextResponse.json(
        { error: "Ingresa la clave de administrador de 4 dígitos" },
        { status: 400 }
      );
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No hay cambios para guardar" }, { status: 400 });
    }

    await connectMongo();

    const schedule = await getScheduleConfig();
    const currentMasterPin = String(schedule.masterLoginCode || "0000").trim();

    if (adminPin !== currentMasterPin) {
      return NextResponse.json({ error: "PIN de administrador incorrecto" }, { status: 401 });
    }

    const applied = [];

    for (const item of updates) {
      const role = String(item?.role || "").trim().toLowerCase();
      const id = String(item?.id || "").trim().toUpperCase();
      const loginCode = String(item?.loginCode || "").trim();

      if (!VALID_ROLES.has(role)) {
        return NextResponse.json({ error: `Rol no válido: ${role}` }, { status: 400 });
      }

      if (!isValidPin(loginCode)) {
        return NextResponse.json(
          { error: `La clave de ${item?.name || id} debe ser de 4 dígitos` },
          { status: 400 }
        );
      }

      if (role === "master") {
        await PosScheduleConfig.findOneAndUpdate(
          { configCode: "default" },
          { $set: { masterLoginCode: loginCode } },
          { upsert: true, new: true }
        );
        applied.push({ role, id: "MASTER", loginCode });
        continue;
      }

      if (role === "staff") {
        const updated = await PosStaff.findOneAndUpdate(
          { staffCode: id },
          { $set: { loginCode } },
          { new: true }
        );
        if (!updated) {
          return NextResponse.json(
            { error: `Manicurista ${id} no encontrada` },
            { status: 404 }
          );
        }
        applied.push({ role, id, loginCode });
        continue;
      }

      if (role === "reception") {
        const updated = await PosReceptionist.findOneAndUpdate(
          { receptionistCode: id },
          { $set: { loginCode } },
          { new: true }
        );
        if (!updated) {
          return NextResponse.json(
            { error: `Recepcionista ${id} no encontrada` },
            { status: 404 }
          );
        }
        applied.push({ role, id, loginCode });
        continue;
      }

      if (role === "accountant") {
        const updated = await PosAccountant.findOneAndUpdate(
          { accountantCode: id },
          { $set: { loginCode } },
          { new: true }
        );
        if (!updated) {
          return NextResponse.json(
            { error: `Contabilidad ${id} no encontrada` },
            { status: 404 }
          );
        }
        applied.push({ role, id, loginCode });
        continue;
      }

      if (role === "marketing") {
        const updated = await PosMarketingAgency.findOneAndUpdate(
          { agencyCode: id },
          { $set: { loginCode } },
          { new: true }
        );
        if (!updated) {
          return NextResponse.json(
            { error: `Agencia ${id} no encontrada` },
            { status: 404 }
          );
        }
        applied.push({ role, id, loginCode });
      }
    }

    return NextResponse.json({ success: true, updated: applied });
  } catch (error) {
    console.error("PATCH /api/pos/admin/login-codes", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron guardar las claves" },
      { status: 500 }
    );
  }
}
