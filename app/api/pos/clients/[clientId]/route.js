import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapClientDoc } from "@/libs/posMappers";
import PosClient from "@/models/PosClient";
import PosAppointment from "@/models/PosAppointment";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const { clientId } = await params;
    const body = await req.json();

    await connectMongo();

    const updated = await PosClient.findOneAndUpdate(
      { clientCode: clientId },
      {
        ...(body.name ? { name: body.name } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.birthday !== undefined ? { birthday: body.birthday } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.isPlatinum !== undefined ? { isPlatinum: body.isPlatinum } : {}),
        ...(body.memberSince !== undefined ? { memberSince: body.memberSince } : {}),
        ...(body.bio !== undefined ? { bio: body.bio } : {}),
        ...(body.styleProfile ? { styleProfile: body.styleProfile } : {}),
        ...(body.alerts ? { alerts: body.alerts } : {}),
        ...(body.totalSpent !== undefined ? { totalSpent: body.totalSpent } : {}),
        ...(body.visitsCount !== undefined ? { visitsCount: body.visitsCount } : {}),
        ...(body.averageTicket !== undefined
          ? { averageTicket: body.averageTicket }
          : {}),
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    return NextResponse.json(mapClientDoc(updated));
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
