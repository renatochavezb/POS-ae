const MONTH_NAME_TO_INDEX = {
  ene: 0,
  enero: 0,
  jan: 0,
  feb: 1,
  febrero: 1,
  mar: 2,
  marzo: 2,
  abr: 3,
  abril: 3,
  apr: 3,
  may: 4,
  mayo: 4,
  jun: 5,
  junio: 5,
  jul: 6,
  julio: 6,
  ago: 7,
  agosto: 7,
  aug: 7,
  sep: 8,
  sept: 8,
  septiembre: 8,
  oct: 9,
  octubre: 9,
  nov: 10,
  noviembre: 10,
  dic: 11,
  diciembre: 11,
  dec: 11,
};

export function parseSpanishShortDateLabel(label) {
  const trimmed = String(label || "").trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})\s+([A-Za-záéíóúÁÉÍÓÚ]{3,9}),?\s*(\d{4})?$/i);
  if (!match) return null;

  const day = Number(match[1]);
  const monthKey = match[2]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const month =
    MONTH_NAME_TO_INDEX[monthKey.slice(0, 3)] ?? MONTH_NAME_TO_INDEX[monthKey];
  const year = match[3] ? Number(match[3]) : null;

  if (month == null || Number.isNaN(day)) return null;
  if (year == null || Number.isNaN(year)) return null;

  return new Date(year, month, day);
}

export function compareSpanishShortDates(a, b) {
  const left = parseSpanishShortDateLabel(a);
  const right = parseSpanishShortDateLabel(b);
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return left.getTime() - right.getTime();
}
