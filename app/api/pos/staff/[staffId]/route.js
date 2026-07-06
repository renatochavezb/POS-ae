import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapStaffDoc } from "@/libs/posMappers";
import PosStaff from "@/models/PosStaff";
import PosAppointment from "@/models/PosAppointment";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const { staffId } = await params;
    const body = await req.json();

    await connectMongo();

    const updated = await PosStaff.findOneAndUpdate(
      { staffCode: staffId },
      {
        ...(body.status ? { status: body.status } : {}),
        ...(body.name ? { name: body.name } : {}),
        ...(body.role ? { role: body.role } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.rating !== undefined ? { rating: body.rating } : {}),
        ...(body.commissionPercent !== undefined
          ? { commissionPercent: body.commissionPercent }
          : {}),
        ...(body.image !== undefined ? { image: body.image } : {}),
        ...(body.specialty !== undefined ? { specialty: body.specialty } : {}),
        ...(body.shift !== undefined ? { shift: body.shift } : {}),
        ...(body.bio !== undefined ? { bio: body.bio } : {}),
        ...(body.completedToday !== undefined
          ? { completedToday: body.completedToday }
          : {}),
        ...(body.totalToday !== undefined ? { totalToday: body.totalToday } : {}),
        ...(body.weeklyRevenue !== undefined
          ? { weeklyRevenue: body.weeklyRevenue }
          : {}),
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Manicurista no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(mapStaffDoc(updated));
  } catch (error) {
    console.error("PATCH /api/pos/staff/[staffId]", error);
    return NextResponse.json(
      { error: error.message || "No se pudo actualizar la manicurista" },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const { staffId } = await params;

    await connectMongo();

    const staff = await PosStaff.findOne({ staffCode: staffId });

    if (!staff) {
      return NextResponse.json(
        { error: "Manicurista no encontrada en la base de datos" },
        { status: 404 }
      );
    }

    if (staff.isActive === false) {
      return NextResponse.json(
        { error: "Esta manicurista ya está dada de baja" },
        { status: 409 }
      );
    }

    const appointmentCount = await PosAppointment.countDocuments({ staffId });
    const deactivatedAt = new Date();
    const deactivatedAgendaDate = getTodaySpanishShortDate();

    await PosStaff.updateOne(
      { staffCode: staffId },
      {
        $set: {
          isActive: false,
          status: "offline",
          deactivatedAt,
          deactivatedAgendaDate,
        },
      }
    );

    return NextResponse.json({
      success: true,
      deactivated: true,
      hadAppointments: appointmentCount > 0,
      deactivatedAt: deactivatedAt.toISOString(),
      deactivatedAgendaDate,
    });
  } catch (error) {
    console.error("DELETE /api/pos/staff/[staffId]", error);
    return NextResponse.json(
      { error: error.message || "No se pudo dar de baja a la manicurista" },
      { status: 500 }
    );
  }
}
