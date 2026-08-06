import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import PosCashTicket from "@/models/PosCashTicket";
import PosAppointment from "@/models/PosAppointment";
import { mapCashTicketDoc } from "@/libs/posMappers";

export const dynamic = "force-dynamic";

function normalizeLines(rawLines) {
  if (!Array.isArray(rawLines)) return [];

  return rawLines
    .map((line) => ({
      serviceId: String(line?.serviceId || "").trim(),
      name: String(line?.name || "").trim(),
      price: Number(line?.price ?? 0),
    }))
    .filter((line) => line.name.length > 0 && line.price >= 0);
}

function sumLines(lines) {
  return lines.reduce((sum, line) => sum + line.price, 0);
}

export async function PATCH(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const ticketCode = String(params?.ticketId || "").trim();
    if (!ticketCode) {
      return NextResponse.json({ error: "Ficha no válida" }, { status: 400 });
    }

    const body = await req.json();
    const lines = normalizeLines(body?.lines);

    if (lines.length === 0) {
      return NextResponse.json(
        { error: "Agrega al menos un servicio con precio" },
        { status: 400 }
      );
    }

    if (lines.some((line) => line.price <= 0)) {
      return NextResponse.json(
        { error: "Cada servicio debe tener un precio mayor a cero" },
        { status: 400 }
      );
    }

    await connectMongo();

    const ticket = await PosCashTicket.findOne({ ticketCode });
    if (!ticket) {
      return NextResponse.json({ error: "Ficha no encontrada" }, { status: 404 });
    }

    if (ticket.status !== "submitted") {
      return NextResponse.json(
        { error: "Solo se pueden editar fichas pendientes de cobro" },
        { status: 409 }
      );
    }

    const subtotal = sumLines(lines);
    const serviceName = lines.map((line) => line.name).join(" + ");

    const updatedTicket = await PosCashTicket.findOneAndUpdate(
      { ticketCode },
      { $set: { lines, subtotal } },
      { new: true }
    );

    await PosAppointment.updateOne(
      { appointmentCode: ticket.appointmentCode },
      { $set: { serviceName, cost: subtotal } }
    );

    return NextResponse.json({
      ticket: mapCashTicketDoc(updatedTicket, { includeWorkPhotos: true }),
    });
  } catch (error) {
    console.error("PATCH /api/pos/cash-tickets/[ticketId]", error);
    return NextResponse.json(
      { error: error.message || "No se pudo actualizar la ficha" },
      { status: 500 }
    );
  }
}
