import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { requirePosSession } from "@/libs/posAuth";

export const dynamic = "force-dynamic";

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_PHOTOS = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function sanitizeCode(value) {
  return String(value || "work")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .slice(0, 40);
}

export async function POST(req) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const formData = await req.formData();
    const appointmentCode = sanitizeCode(formData.get("appointmentId"));
    const files = formData
      .getAll("photos")
      .filter((entry) => entry && typeof entry !== "string");

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Agrega al menos una foto del trabajo" },
        { status: 400 }
      );
    }

    if (files.length > MAX_PHOTOS) {
      return NextResponse.json(
        { error: `Máximo ${MAX_PHOTOS} fotos por ficha` },
        { status: 400 }
      );
    }

    const photosDir = path.join(process.cwd(), "public", "cash-ticket-photos");
    await mkdir(photosDir, { recursive: true });

    const uploaded = [];
    const stamp = Date.now();

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const originalName = file.name || `foto-${index + 1}.jpg`;
      const ext = path.extname(originalName).toLowerCase() || ".jpg";

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          { error: "Formato no permitido. Usa JPG, PNG o WEBP." },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Cada foto no puede pesar más de 5 MB." },
          { status: 400 }
        );
      }

      const normalizedExt = ext === ".jpeg" ? ".jpg" : ext;
      const filename = `${appointmentCode}-${stamp}-${index + 1}${normalizedExt}`;
      const bytes = await file.arrayBuffer();
      await writeFile(path.join(photosDir, filename), Buffer.from(bytes));
      uploaded.push(`/cash-ticket-photos/${filename}`);
    }

    return NextResponse.json({ photos: uploaded });
  } catch (error) {
    console.error("POST /api/pos/cash-tickets/work-photos", error);
    return NextResponse.json(
      { error: error.message || "No se pudieron subir las fotos" },
      { status: 500 }
    );
  }
}
