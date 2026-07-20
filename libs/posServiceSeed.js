import { INITIAL_SERVICES } from "@/components/pos/data";
import {
  buildPriceListSeedDocs,
  LEGACY_SOURCE,
  PRICE_LIST_SOURCE,
} from "@/libs/posPriceList";

/** Precios base en MXN para el catálogo legacy (editables después en Mongo). */
export const DEFAULT_SERVICE_PRICES = {
  "SRV-SGEL": 220,
  "SRV-RUBBER": 250,
  "SRV-ACR": 280,
  "SRV-TIPS": 260,
  "SRV-RET": 120,
  "SRV-DIS": 300,
  "SRV-POLY": 260,
  "SRV-GCON": 240,
  "SRV-ACRIG": 270,
  "SRV-TECH": 250,
  "SRV-DUAL": 290,
  "SRV-GMAN": 220,
  "SRV-HIBR": 320,
  "SRV-MAN": 180,
  "SRV-PED": 220,
  "SRV-ACPIE": 280,
  "SRV-LAMC": 350,
  "SRV-LAMPE": 380,
  "SRV-LASH": 450,
  "SRV-BROW": 200,
  "SRV-BLOW": 280,
  "SRV-CUT": 200,
  "SRV-COLOR": 450,
  "SRV-FAC": 350,
  "SRV-WAX": 150,
};

export function buildLegacyServiceSeedDocs() {
  return INITIAL_SERVICES.map((service, index) => ({
    serviceCode: service.id,
    name: service.name,
    category: service.category,
    subtitle: service.subtitle,
    price: DEFAULT_SERVICE_PRICES[service.id] ?? service.price ?? 0,
    duration: service.duration,
    image: service.image || "",
    description: service.description || "",
    staffIds: service.staffIds || [],
    exclusive: Boolean(service.exclusive),
    isActive: true,
    pricingMode: "fixed",
    nailMax: 1,
    sortOrder: 1000 + index,
    source: LEGACY_SOURCE,
  }));
}

/** @deprecated Usar buildLegacyServiceSeedDocs + ensurePriceListServices */
export function buildServiceSeedDocs() {
  return [...buildPriceListSeedDocs(), ...buildLegacyServiceSeedDocs()];
}

/**
 * Inserta/actualiza la lista oficial sin borrar servicios legacy.
 * @param {import("mongoose").Model} PosService
 */
export async function ensurePriceListServices(PosService) {
  const docs = buildPriceListSeedDocs();
  let upserted = 0;

  for (const doc of docs) {
    const result = await PosService.updateOne(
      { serviceCode: doc.serviceCode },
      {
        $set: {
          name: doc.name,
          category: doc.category,
          subtitle: doc.subtitle,
          duration: doc.duration,
          image: doc.image,
          description: doc.description,
          pricingMode: doc.pricingMode,
          nailMax: doc.nailMax,
          sortOrder: doc.sortOrder,
          source: PRICE_LIST_SOURCE,
          isActive: true,
        },
        $setOnInsert: {
          serviceCode: doc.serviceCode,
          price: doc.price,
          staffIds: doc.staffIds,
          exclusive: doc.exclusive,
        },
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0 || result.modifiedCount > 0) {
      upserted += 1;
    }
  }

  await PosService.updateMany(
    { $or: [{ source: { $exists: false } }, { source: null }] },
    {
      $set: {
        source: LEGACY_SOURCE,
        pricingMode: "fixed",
        nailMax: 1,
      },
    }
  );

  const needsSort = await PosService.find({
    source: { $ne: PRICE_LIST_SOURCE },
    $or: [{ sortOrder: { $exists: false } }, { sortOrder: { $lt: 1000 } }],
  }).select("_id sortOrder");

  await Promise.all(
    needsSort.map((row, index) =>
      PosService.updateOne(
        { _id: row._id },
        { $set: { sortOrder: 1000 + index, source: LEGACY_SOURCE } }
      )
    )
  );

  return { upserted, priceListCount: docs.length };
}
