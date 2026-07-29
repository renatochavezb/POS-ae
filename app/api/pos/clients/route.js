import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapClientDoc } from "@/libs/posMappers";
import { seedPosClientsIfEmpty } from "@/libs/posSeed";
import PosClient from "@/models/PosClient";
import {
  duplicateClientMessage,
  findDuplicateClient,
  generateNextClientCode,
  normalizeEmail,
  normalizePhone,
} from "@/libs/posClientIdentity";
import { syncClientCrmSegments } from "@/libs/posClientCrmSegments";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";

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
    const name = String(body?.name || "").trim();
    const phone = String(body?.phone || "").trim();
    const email = String(body?.email || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "El nombre de la clienta es obligatorio" },
        { status: 400 }
      );
    }

    if (normalizePhone(phone).length < 10) {
      return NextResponse.json(
        { error: "Ingresa un teléfono válido de 10 dígitos para evitar registros duplicados." },
        { status: 400 }
      );
    }

    await connectMongo();

    const duplicate = await findDuplicateClient({ phone, email });
    if (duplicate) {
      return NextResponse.json(
        {
          error: duplicateClientMessage(duplicate),
          duplicateClientId: duplicate.client.clientCode,
          duplicateClientName: duplicate.client.name,
        },
        { status: 409 }
      );
    }

    const clientCode = await generateNextClientCode();
    const registeredAt = new Date();
    const memberSince = getTodaySpanishShortDate();
    const phoneNormalized = normalizePhone(phone);
    const emailNormalized = normalizeEmail(email);

    const payload = {
      clientCode,
      name,
      email,
      phone,
      birthday: body.birthday || "No especificado",
      address: body.address || "No especificada",
      isPlatinum: false,
      memberSince,
      registeredAt,
      lastPaidVisitDate: "",
      bio: body.bio || "Nueva clienta registrada en recepción.",
      styleProfile: body.styleProfile || {
        bio: "Por definir en la primera visita.",
        tags: ["Nueva"],
      },
      alerts: body.alerts || [],
      totalSpent: 0,
      visitsCount: 0,
      averageTicket: 0,
      phoneNormalized,
    };

    if (emailNormalized) {
      payload.emailNormalized = emailNormalized;
    }

    const created = await PosClient.create(payload);
    await syncClientCrmSegments(clientCode);
    const fresh = await PosClient.findOne({ clientCode });

    return NextResponse.json(mapClientDoc(fresh), { status: 201 });
  } catch (error) {
    console.error("POST /api/pos/clients", error);

    if (error?.code === 11000) {
      return NextResponse.json(
        { error: "Ya existe una clienta con ese teléfono o correo." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || "No se pudo registrar la clienta" },
      { status: 500 }
    );
  }
}
