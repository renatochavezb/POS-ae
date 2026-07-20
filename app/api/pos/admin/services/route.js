import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { rejectUnauthorizedAdmin } from "@/libs/posAdminAuth";
import PosService from "@/models/PosService";
import { mapServiceDoc } from "@/libs/posMappers";
import { ensurePriceListServices } from "@/libs/posServiceSeed";

export const dynamic = "force-dynamic";

/** Lista completa (incluye inactivos) — solo administrador. */
export async function GET(req) {
  try {
    const gate = rejectUnauthorizedAdmin(req, ["master"]);
    if (gate.error) return gate.error;

    await connectMongo();
    await ensurePriceListServices(PosService);

    const services = await PosService.find({}).sort({ sortOrder: 1, name: 1 });
    return NextResponse.json({
      services: services.map(mapServiceDoc),
      actor: gate.actor,
    });
  } catch (error) {
    console.error("GET /api/pos/admin/services", error);
    return NextResponse.json(
      { error: error.message || "No se pudo cargar la lista de precios" },
      { status: 500 }
    );
  }
}

/** Actualiza precio / modo de un servicio — solo administrador. */
export async function PATCH(req) {
  try {
    const gate = rejectUnauthorizedAdmin(req, ["master"]);
    if (gate.error) return gate.error;

    const body = await req.json();
    const serviceCode = String(body.serviceCode || body.id || "").trim();
    if (!serviceCode) {
      return NextResponse.json({ error: "Falta serviceCode" }, { status: 400 });
    }

    await connectMongo();
    const service = await PosService.findOne({ serviceCode });
    if (!service) {
      return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
    }

    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
      }
      service.price = price;
    }

    if (body.pricingMode === "fixed" || body.pricingMode === "per_nail") {
      service.pricingMode = body.pricingMode;
      if (body.pricingMode === "per_nail" && !service.nailMax) {
        service.nailMax = 20;
      }
      if (body.pricingMode === "fixed") {
        service.nailMax = 1;
      }
    }

    if (body.nailMax !== undefined) {
      const nailMax = Math.max(1, Math.min(40, Number(body.nailMax) || 1));
      service.nailMax = nailMax;
    }

    if (typeof body.name === "string" && body.name.trim()) {
      service.name = body.name.trim();
    }

    if (typeof body.isActive === "boolean") {
      service.isActive = body.isActive;
    }

    await service.save();

    return NextResponse.json({ service: mapServiceDoc(service) });
  } catch (error) {
    console.error("PATCH /api/pos/admin/services", error);
    return NextResponse.json(
      { error: error.message || "No se pudo actualizar el precio" },
      { status: 500 }
    );
  }
}
