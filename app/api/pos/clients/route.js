import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapClientDoc } from "@/libs/posMappers";
import { seedPosClientsIfEmpty } from "@/libs/posSeed";
import PosClient from "@/models/PosClient";
import PosAppointment from "@/models/PosAppointment";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    await connectMongo();
    await seedPosClientsIfEmpty();

    const clients = await PosClient.find().sort({ name: 1 });
    return NextResponse.json(clients.map(mapClientDoc));
  } catch (error) {
    console.error("GET /api/pos/clients", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar los clientes" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const body = await req.json();

    if (!body?.name) {
      return NextResponse.json(
        { error: "El nombre del cliente es obligatorio" },
        { status: 400 }
      );
    }

    await connectMongo();

    const clientCode =
      body.clientCode || `SA-${Math.floor(1000 + Math.random() * 9000)}`;

    const existing = await PosClient.findOne({ clientCode });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un cliente con ese ID" },
        { status: 409 }
      );
    }

    const created = await PosClient.create({
      clientCode,
      name: body.name,
      email: body.email || "",
      phone: body.phone || "",
      birthday: body.birthday || "No especificado",
      address: body.address || "No especificada",
      isPlatinum: body.isPlatinum ?? true,
      memberSince: body.memberSince || new Date().getFullYear().toString(),
      bio: body.bio || "Nuevo cliente VIP registrado en recepción.",
      styleProfile: body.styleProfile || {
        bio: "Por definir en la primera sesión técnica.",
        tags: ["New Client"],
      },
      alerts: body.alerts || [],
      totalSpent: body.totalSpent ?? 0,
      visitsCount: body.visitsCount ?? 0,
      averageTicket: body.averageTicket ?? 0,
    });

    return NextResponse.json(mapClientDoc(created), { status: 201 });
  } catch (error) {
    console.error("POST /api/pos/clients", error);
    return NextResponse.json(
      { error: error.message || "No se pudo registrar el cliente" },
      { status: 500 }
    );
  }
}
