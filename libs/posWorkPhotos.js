const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function isValidWorkPhotoUrl(photo) {
  const value = String(photo || "").trim();
  return (
    value.startsWith("/cash-ticket-photos/") ||
    value.startsWith("data:image/jpeg;base64,") ||
    value.startsWith("data:image/png;base64,") ||
    value.startsWith("data:image/webp;base64,")
  );
}

export function normalizeWorkPhotos(rawPhotos, maxPhotos = 3) {
  if (!Array.isArray(rawPhotos)) return [];

  return rawPhotos
    .map((photo) => String(photo || "").trim())
    .filter(isValidWorkPhotoUrl)
    .slice(0, maxPhotos);
}

export function fileToWorkPhotoDataUrl(file, ext) {
  const normalizedExt = ext === ".jpeg" ? ".jpg" : ext;
  const mime = MIME_BY_EXT[normalizedExt] || "image/jpeg";
  return `data:${mime};base64,${Buffer.from(file).toString("base64")}`;
}
