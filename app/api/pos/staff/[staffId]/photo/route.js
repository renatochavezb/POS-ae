import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import connectMongo from "@/libs/mongoose";
import { requirePosSession } from "@/libs/posAuth";
import { mapStaffDoc } from "@/libs/posMappers";
import PosStaff from "@/models/PosStaff";

export const dynamic = "force-dynamic";

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function staffPhotoSlug(name) {
  return (
    String(name || "staff")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "staff"
  );
}

export async function POST(req, { params }) {
  try {
    const authResult = await requirePosSession();
    if (authResult.error) return authResult.error;

    const { staffId } = await params;
    const formData = await req.formData();
    const file = formData.get("photo");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Selecciona un archivo de imagen" },
        { status: 400 }
      );
    }

    const originalName = file.name || "foto.jpg";
    const ext = path.extname(originalName).toLowerCase() || ".jpg";

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usa JPG, PNG o WEBP." },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "La imagen no puede pesar más de 5 MB." },
        { status: 400 }
      );
    }

    await connectMongo();

    const staff = await PosStaff.findOne({ staffCode: staffId });

    if (!staff) {
      return NextResponse.json(
        { error: "Manicurista no encontrada" },
        { status: 404 }
      );
    }

    const slug = staffPhotoSlug(staff.name);
    const filename = `${slug}${ext === ".jpeg" ? ".jpg" : ext}`;
    const staffDir = path.join(process.cwd(), "public", "staff");
    await mkdir(staffDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    await writeFile(path.join(staffDir, filename), Buffer.from(bytes));

    const imagePath = `/staff/${filename}`;

    const updated = await PosStaff.findOneAndUpdate(
      { staffCode: staffId },
      { $set: { image: imagePath } },
      { new: true }
    );

    return NextResponse.json(mapStaffDoc(updated));
  } catch (error) {
    console.error("POST /api/pos/staff/[staffId]/photo", error);
    return NextResponse.json(
      { error: error.message || "No se pudo subir la foto" },
      { status: 500 }
    );
  }
}
