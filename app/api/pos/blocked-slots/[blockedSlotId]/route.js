import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession, rejectManicuristaAgendaMutation } from "@/libs/posAuth";
import PosBlockedSlot from "@/models/PosBlockedSlot";

export const dynamic = "force-dynamic";

export async function DELETE(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const manicuristaBlock = rejectManicuristaAgendaMutation(req, "abrir horarios cerrados");
    if (manicuristaBlock) return manicuristaBlock;

    const { blockedSlotId } = await params;

    await connectMongo();

    const deleted = await PosBlockedSlot.findOneAndDelete({
      blockedSlotCode: blockedSlotId,
    });

    if (!deleted) {
      return NextResponse.json(
        { error: "Cierre de horario no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/pos/blocked-slots/[blockedSlotId]", error);
    return NextResponse.json(
      { error: error.message || "No se pudo abrir el horario" },
      { status: 500 }
    );
  }
}
