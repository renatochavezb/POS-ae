/**
 * Lista oficial de precios (Servicios ae.xlsx).
 * Se antepone al catálogo legacy; no elimina servicios ya dados de alta.
 */

export const PRICE_LIST_SOURCE = "price_list";
export const LEGACY_SOURCE = "legacy";

/** @typedef {'fixed' | 'per_nail'} PricingMode */

/**
 * @typedef {Object} PriceListItem
 * @property {string} serviceCode
 * @property {string} name
 * @property {string} category
 * @property {string} subtitle
 * @property {number} price
 * @property {PricingMode} pricingMode
 * @property {number} nailMax
 * @property {number} sortOrder
 * @property {number} [duration]
 */

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

function inferCategory(name) {
  const n = name.toUpperCase();
  if (/PEDICURA|MANICURA|MANOS|PIES/.test(n) && !/GEL EN|UÑAS|UNAS|ACRIL|GEL |RUBBER|TIP|DISEÑO|EFECTOS/.test(n)) {
    return "Manos y pies";
  }
  if (/LIFTING|LAMINADO|CEJA|PESTAÑ|PESTAN/.test(n)) {
    return "Cejas y mirada";
  }
  if (/CABELLO|PLANCHADO|PLANNCHADO|RIZADO|FACIAL|DEPIL|WAX/.test(n)) {
    return "Cabello, estética y cuerpo";
  }
  return "Uñas";
}

function isPerNail(name) {
  return /X\s*U[ÑN]A/i.test(name);
}

/** Filas exactas del Excel «Servicios ae». */
const RAW_PRICE_ROWS = [
  ["GEL EN MANOS", 220],
  ["GEL EN PIES", 200],
  ["RUBBER", 350],
  ["BAÑO DE ACRILICO", 460],
  ["UÑAS ESCULTURALES 1 AL 3", 750],
  ["UÑAS ESCULTURALES 4 AL 6", 900],
  ["UÑAS TIP 1 AL 3", 650],
  ["UÑAS TIP 4 AL 6", 800],
  ["RETOQUE ACRILICO", 400],
  ["RETIRO ACRILICO", 140],
  ["RETIRO GEL", 100],
  ["MANICURA RUSA", 150],
  ["MANICURA SENCILLA", 150],
  ["MANICURA COMPLETA", 350],
  ["MANICURA ESPECIAL", 450],
  ["PEDICURA SENCILLA", 460],
  ["PEDICURA COMPLETA", 540],
  ["PEDICURA ESPECIAL", 640],
  ["LIFTING", 450],
  ["LAMINADO", 450],
  ["PLANCHADO CABELLO", 300],
  ["RIZADO LARGO", 350],
  ["ACRIGEL", 350],
  ["CALCIO", 360],
  ["VITA", 350],
  ["FACIAL RED", 550],
  ["DISEÑO SENCILLO X UÑA", 15],
  ["DISEÑO INTERMEDIO X UÑA", 25],
  ["DISEÑO ELABORADO X UÑA", 35],
  ["EFECTOS X UÑA", 15],
];

/** @type {PriceListItem[]} */
export const OFFICIAL_PRICE_LIST = RAW_PRICE_ROWS.map(([name, price], index) => {
  const perNail = isPerNail(name);
  const category = inferCategory(name);
  return {
    serviceCode: slugCode(name),
    name,
    category,
    subtitle: perNail ? "Precio por uña · multiplicar cantidad" : "Lista de precios",
    price,
    pricingMode: perNail ? "per_nail" : "fixed",
    nailMax: perNail ? 20 : 1,
    sortOrder: index + 1,
    duration: perNail ? 15 : 60,
    source: PRICE_LIST_SOURCE,
    exclusive: false,
    staffIds: [],
    isActive: true,
    image: "",
    description: perNail
      ? "Precio unitario por uña. En cobro se multiplica por cantidad (manos o manos y pies)."
      : "",
  };
});

export function normalizeServiceNameKey(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Parsea filas de Excel: columna A = nombre, B = precio (número o "$220").
 * Soporta con o sin encabezados.
 * @param {Array<Record<string, unknown>> | unknown[][]} rows
 */
export function parsePriceListRows(rows) {
  const parsed = [];

  for (const row of rows) {
    if (Array.isArray(row)) {
      const name = String(row[0] || "").trim();
      if (!name || /^(nombre|servicio|name)$/i.test(name)) continue;
      const price = Number(String(row[1] ?? "").replace(/[^\d.-]/g, "").trim());
      if (!Number.isFinite(price) || price < 0) continue;
      const perNail = isPerNail(name);
      parsed.push({
        name,
        price,
        pricingMode: perNail ? "per_nail" : "fixed",
        nailMax: perNail ? 20 : 1,
        category: inferCategory(name),
        nameKey: normalizeServiceNameKey(name),
      });
      continue;
    }

    const keys = Object.keys(row || {});
    if (keys.length === 0) continue;

    // sheet_to_json sin header: la 1ª fila queda como nombres de columna
    const looksLikePriceHeader = keys.some((k) => /^\$?\d/.test(String(k).trim()));
    if (looksLikePriceHeader && keys.length >= 2) {
      const name = String(keys[0] || "").trim();
      const price = Number(String(keys[1] ?? "").replace(/[^\d.-]/g, "").trim());
      if (name && Number.isFinite(price) && price >= 0) {
        const perNail = isPerNail(name);
        parsed.push({
          name,
          price,
          pricingMode: perNail ? "per_nail" : "fixed",
          nailMax: perNail ? 20 : 1,
          category: inferCategory(name),
          nameKey: normalizeServiceNameKey(name),
        });
      }
    }

    const nameRaw =
      row.Nombre ??
      row.nombre ??
      row.Servicio ??
      row.servicio ??
      row.Name ??
      row[keys[0]];

    const priceRaw =
      row.Precio ??
      row.precio ??
      row.Price ??
      row.price ??
      (keys[1] ? row[keys[1]] : undefined);

    const name = String(nameRaw || "").trim();
    if (!name) continue;
    if (/^(nombre|servicio|name)$/i.test(name)) continue;

    const price = Number(
      String(priceRaw ?? "")
        .replace(/[^\d.-]/g, "")
        .trim()
    );

    if (!Number.isFinite(price) || price < 0) continue;

    const perNail = isPerNail(name);
    parsed.push({
      name,
      price,
      pricingMode: perNail ? "per_nail" : "fixed",
      nailMax: perNail ? 20 : 1,
      category: inferCategory(name),
      nameKey: normalizeServiceNameKey(name),
    });
  }

  // Deduplicar por nameKey (primera aparición gana)
  const seen = new Set();
  return parsed.filter((row) => {
    if (seen.has(row.nameKey)) return false;
    seen.add(row.nameKey);
    return true;
  });
}

export function buildPriceListSeedDocs() {
  return OFFICIAL_PRICE_LIST.map((item) => ({
    serviceCode: item.serviceCode,
    name: item.name,
    category: item.category,
    subtitle: item.subtitle,
    price: item.price,
    duration: item.duration,
    image: item.image || "",
    description: item.description || "",
    staffIds: item.staffIds || [],
    exclusive: Boolean(item.exclusive),
    isActive: true,
    pricingMode: item.pricingMode,
    nailMax: item.nailMax,
    sortOrder: item.sortOrder,
    source: PRICE_LIST_SOURCE,
  }));
}

/**
 * Calcula el total de un servicio (fijo o por uña).
 * @param {{ price?: number, pricingMode?: string }} service
 * @param {number} [quantity]
 */
export function resolveServiceLinePrice(service, quantity = 1) {
  const unit = Number(service?.price) || 0;
  if (service?.pricingMode === "per_nail") {
    const qty = Math.max(1, Math.min(Number(quantity) || 1, Number(service.nailMax) || 20));
    return unit * qty;
  }
  return unit;
}

export function formatPerNailLabel(serviceName, quantity, scope) {
  const scopeLabel =
    scope === "manos_pies" ? "manos y pies" : scope === "manos" ? "manos" : "";
  const qtyPart = `× ${quantity} uña${quantity === 1 ? "" : "s"}`;
  return scopeLabel
    ? `${serviceName} ${qtyPart} (${scopeLabel})`
    : `${serviceName} ${qtyPart}`;
}
