import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import connectMongo from "@/libs/mongoose";
import { rejectUnauthorizedAdmin } from "@/libs/posAdminAuth";
import PosService from "@/models/PosService";
import { mapServiceDoc } from "@/libs/posMappers";
import {
  normalizeServiceNameKey,
  parsePriceListRows,
  PRICE_LIST_SOURCE,
} from "@/libs/posPriceList";

export const dynamic = "force-dynamic";

function slugCode(name) {
  const slug = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  return `PL-${slug || "SERVICIO"}`;
}

/**
 * Importa Excel de precios (columna nombre + precio).
 * Actualiza por código o por nombre; no elimina servicios existentes.
 */
export async function POST(req) {
  try {
    const gate = rejectUnauthorizedAdmin(req, ["master"]);
    if (gate.error) return gate.error;

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Adjunta un archivo Excel (.xlsx)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: "El Excel no tiene hojas" }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    // header:1 → arrays [nombre, precio], incluye la primera fila del Excel sin encabezados
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const parsed = parsePriceListRows(rows);

    if (parsed.length === 0) {
      return NextResponse.json(
        {
          error:
            "No se encontraron filas válidas. Usa columnas Nombre y Precio (o A=nombre, B=precio).",
        },
        { status: 400 }
      );
    }

    await connectMongo();

    const existing = await PosService.find({});
    const byCode = new Map(existing.map((s) => [s.serviceCode, s]));
    const byName = new Map(
      existing.map((s) => [normalizeServiceNameKey(s.name), s])
    );

    const maxSort =
      existing
        .filter((s) => s.source === PRICE_LIST_SOURCE)
        .reduce((max, s) => Math.max(max, Number(s.sortOrder) || 0), 0) || 0;

    let updated = 0;
    let created = 0;
    const results = [];

    for (let i = 0; i < parsed.length; i += 1) {
      const row = parsed[i];
      const code = slugCode(row.name);
      let doc = byCode.get(code) || byName.get(row.nameKey);

      if (doc) {
        doc.price = row.price;
        doc.pricingMode = row.pricingMode;
        doc.nailMax = row.nailMax;
        if (doc.source !== PRICE_LIST_SOURCE) {
          doc.source = PRICE_LIST_SOURCE;
        }
        if (!doc.sortOrder || doc.sortOrder >= 1000) {
          doc.sortOrder = maxSort + i + 1;
        }
        doc.isActive = true;
        await doc.save();
        updated += 1;
        results.push(mapServiceDoc(doc));
      } else {
        const createdDoc = await PosService.create({
          serviceCode: code,
          name: row.name,
          category: row.category,
          subtitle:
            row.pricingMode === "per_nail"
              ? "Precio por uña · multiplicar cantidad"
              : "Lista de precios",
          price: row.price,
          duration: row.pricingMode === "per_nail" ? 15 : 60,
          pricingMode: row.pricingMode,
          nailMax: row.nailMax,
          sortOrder: maxSort + i + 1,
          source: PRICE_LIST_SOURCE,
          staffIds: [],
          exclusive: false,
          isActive: true,
          image: "",
          description: "",
        });
        created += 1;
        byCode.set(code, createdDoc);
        byName.set(row.nameKey, createdDoc);
        results.push(mapServiceDoc(createdDoc));
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      created,
      total: parsed.length,
      services: results,
    });
  } catch (error) {
    console.error("POST /api/pos/admin/services/import", error);
    return NextResponse.json(
      { error: error.message || "No se pudo importar el Excel" },
      { status: 500 }
    );
  }
}
