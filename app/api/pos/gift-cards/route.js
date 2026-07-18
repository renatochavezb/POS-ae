import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import { rejectUnauthorizedAdmin } from "@/libs/posAdminAuth";
import { isMasterSessionRequest } from "@/libs/posAuth";
import PosGiftCard from "@/models/PosGiftCard";
import PosPayment from "@/models/PosPayment";
import {
  getOpenCashSession,
  refreshCashSessionTotals,
  resolvePaymentBreakdown,
} from "@/libs/posCashRegister";
import { mapPaymentDoc } from "@/libs/posMappers";
import { getTodaySpanishShortDate } from "@/components/pos/scheduleUtils";

export const dynamic = "force-dynamic";

const PURCHASE_METHODS = ["efectivo", "tarjeta", "transferencia", "mixto"];
const GIFT_CARD_ROLES = ["master", "reception"];

function createGiftCardCode() {
  return `GC-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function mapGiftCard(doc) {
  const raw = doc.toObject ? doc.toObject() : doc;
  return {
    id: raw.giftCardCode,
    code: raw.giftCardCode,
    initialValue: raw.initialValue,
    balance: raw.balance,
    status: raw.status,
    soldDate: raw.soldDate,
    soldAt: raw.soldAt ? new Date(raw.soldAt).toISOString() : "",
    paymentId: raw.paymentCode,
    cashSessionId: raw.cashSessionCode,
    purchaseMethod: raw.purchaseMethod,
    soldByReceptionistId: raw.soldByReceptionistId || "",
    soldByReceptionistName: raw.soldByReceptionistName || "",
    notes: raw.notes || "",
  };
}

export async function GET(req) {
  try {
    const access = rejectUnauthorizedAdmin(req, GIFT_CARD_ROLES);
    if (access.error) return access.error;

    await connectMongo();
    const status = (req.nextUrl.searchParams.get("status") || "").trim();
    const query = status ? { status } : {};
    const giftCards = await PosGiftCard.find(query).sort({ soldAt: -1 }).limit(200);

    return NextResponse.json({ giftCards: giftCards.map(mapGiftCard) });
  } catch (error) {
    console.error("GET /api/pos/gift-cards", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron cargar las gift cards" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  let createdGiftCard = null;
  let createdPayment = null;

  try {
    const access = rejectUnauthorizedAdmin(req, GIFT_CARD_ROLES);
    if (access.error) return access.error;

    const body = await req.json();
    const value = Number(body?.value ?? 0);
    const method = String(body?.method || "").trim().toLowerCase();
    const notes = String(body?.notes || "").trim();

    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json(
        { error: "El valor de la gift card debe ser mayor a cero" },
        { status: 400 }
      );
    }

    if (!PURCHASE_METHODS.includes(method)) {
      return NextResponse.json(
        { error: "Selecciona efectivo, tarjeta, transferencia o mixto" },
        { status: 400 }
      );
    }

    let breakdown;
    try {
      breakdown = resolvePaymentBreakdown({
        method,
        amount: value,
        tip: 0,
        cashAmount: body?.cashAmount,
        cardAmount: body?.cardAmount,
        transferAmount: body?.transferAmount,
      });
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await connectMongo();

    const openSession = await getOpenCashSession();
    if (!openSession) {
      return NextResponse.json(
        { error: "No hay turno de caja abierto. Abre caja antes de vender una gift card." },
        { status: 409 }
      );
    }

    const cashDay = isMasterSessionRequest(req)
      ? openSession.shiftDate || getTodaySpanishShortDate()
      : getTodaySpanishShortDate();

    let giftCardCode = createGiftCardCode();
    while (await PosGiftCard.exists({ giftCardCode })) {
      giftCardCode = createGiftCardCode();
    }

    const timestamp = Date.now();
    const paymentCode = `PAY-GC-${timestamp}`;
    const saleCode = `GC-SALE-${timestamp}`;
    const soldByReceptionistId = String(
      access.actor?.id || body?.processedByReceptionistId || ""
    )
      .trim()
      .toUpperCase();
    const soldByReceptionistName = String(
      access.actor?.name || body?.processedByReceptionistName || "Administrador"
    ).trim();

    createdGiftCard = await PosGiftCard.create({
      giftCardCode,
      initialValue: value,
      balance: value,
      status: "active",
      soldDate: cashDay,
      soldAt: new Date(),
      paymentCode,
      cashSessionCode: openSession.sessionCode,
      purchaseMethod: method,
      soldByReceptionistId,
      soldByReceptionistName,
      notes,
    });

    createdPayment = await PosPayment.create({
      paymentCode,
      transactionType: "gift_card_sale",
      giftCardCode,
      appointmentCode: saleCode,
      appointmentDate: cashDay,
      clientId: "",
      clientName: "Venta directa",
      staffId: "",
      staffName: "",
      ticketCode: "",
      serviceName: `Gift Card ${giftCardCode}`,
      serviceLines: [],
      amount: breakdown.amount,
      tip: 0,
      total: breakdown.total,
      method,
      cashAmount: breakdown.cashAmount,
      cardAmount: breakdown.cardAmount,
      transferAmount: breakdown.transferAmount,
      giftCardAmount: 0,
      cashSessionCode: openSession.sessionCode,
      processedByReceptionistId: soldByReceptionistId,
      processedByReceptionistName: soldByReceptionistName,
      notes,
    });

    await refreshCashSessionTotals(openSession.sessionCode);

    return NextResponse.json(
      {
        giftCard: mapGiftCard(createdGiftCard),
        payment: mapPaymentDoc(createdPayment),
      },
      { status: 201 }
    );
  } catch (error) {
    if (createdPayment?._id) {
      await PosPayment.deleteOne({ _id: createdPayment._id }).catch(() => {});
    }
    if (createdGiftCard?._id) {
      await PosGiftCard.deleteOne({ _id: createdGiftCard._id }).catch(() => {});
    }
    console.error("POST /api/pos/gift-cards", error);
    return NextResponse.json(
      { error: error.message || "No se pudo vender la gift card" },
      { status: 500 }
    );
  }
}
