import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapClientDoc } from "@/libs/posMappers";
import PosClient from "@/models/PosClient";
import PosAppointment from "@/models/PosAppointment";
import {
  duplicateClientMessage,
  findDuplicateClient,
  normalizeEmail,
  normalizePhone,
} from "@/libs/posClientIdentity";
import { syncClientCrmSegments } from "@/libs/posClientCrmSegments";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const { clientId } = await params;
    const body = await req.json();

    await connectMongo();

    const existing = await PosClient.findOne({ clientCode: clientId });
    if (!existing) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const nextPhone = body.phone !== undefined ? String(body.phone).trim() : existing.phone;
    const nextEmail = body.email !== undefined ? String(body.email).trim() : existing.email;

    const duplicate = await findDuplicateClient({
      phone: nextPhone,
      email: nextEmail,
      excludeClientCode: clientId,
    });

    if (duplicate) {
      return NextResponse.json(
        { error: duplicateClientMessage(duplicate) },
        { status: 409 }
      );
    }

    const patch = {
      ...(body.name ? { name: body.name } : {}),
      ...(body.email !== undefined ? { email: nextEmail } : {}),
      ...(body.phone !== undefined ? { phone: nextPhone } : {}),
      ...(body.birthday !== undefined ? { birthday: body.birthday } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.isPlatinum !== undefined ? { isPlatinum: body.isPlatinum } : {}),
      ...(body.memberSince !== undefined ? { memberSince: body.memberSince } : {}),
      ...(body.bio !== undefined ? { bio: body.bio } : {}),
      ...(body.styleProfile ? { styleProfile: body.styleProfile } : {}),
      ...(body.alerts !== undefined ? { alerts: body.alerts } : {}),
      ...(body.totalSpent !== undefined ? { totalSpent: body.totalSpent } : {}),
      ...(body.visitsCount !== undefined ? { visitsCount: body.visitsCount } : {}),
      ...(body.averageTicket !== undefined
        ? { averageTicket: body.averageTicket }
        : {}),
    };

    if (body.phone !== undefined) {
      patch.phoneNormalized = normalizePhone(nextPhone);
    }

    if (body.email !== undefined) {
      const emailNormalized = normalizeEmail(nextEmail);
      patch.emailNormalized = emailNormalized || undefined;
    }

    const updated = await PosClient.findOneAndUpdate(
      { clientCode: clientId },
      { $set: patch },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    if (body.name && body.name !== existing.name) {
      await PosAppointment.updateMany(
        { clientId },
        { $set: { clientName: body.name } }
      );
    }

    await syncClientCrmSegments(clientId);
    const fresh = await PosClient.findOne({ clientCode: clientId });

    return NextResponse.json(mapClientDoc(fresh));
  } catch (error) {
    console.error("PATCH /api/pos/clients/[clientId]", error);
    return NextResponse.json(
      { error: error.message || "No se pudo actualizar el cliente" },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const { clientId } = await params;

    await connectMongo();

    const appointmentCount = await PosAppointment.countDocuments({ clientId });

    if (appointmentCount > 0) {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar: este cliente tiene citas registradas en la agenda",
        },
        { status: 409 }
      );
    }

    const deleted = await PosClient.findOneAndDelete({ clientCode: clientId });

    if (!deleted) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/pos/clients/[clientId]", error);
    return NextResponse.json(
      { error: error.message || "No se pudo eliminar el cliente" },
      { status: 500 }
    );
  }
}
