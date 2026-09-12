import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import path from "path";
import fs from "fs/promises";
import {
  ALLOWED_UPLOAD_FOLDERS,
  MAX_UPLOAD_BYTES,
  RASTER_IMAGE_TYPES,
  sniffImageType,
} from "@/lib/image-type";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const file = formData.get("file");
  const folder = formData.get("folder");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
  }

  // Ziel-Ordner: strikte Whitelist. Kein Sanitizing, das aus beliebigen
  // Eingaben "irgendeinen" Ordner macht – sonst können Nutzer neue Unterordner
  // anlegen oder in kuratierte Seed-Ordner schreiben.
  const safeFolder = typeof folder === "string" && folder ? folder : "items";
  if (!ALLOWED_UPLOAD_FOLDERS.has(safeFolder)) {
    return NextResponse.json({ error: "Ungültiger Zielordner" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Datei zu groß (max. ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)` },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Datei zu groß (max. ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)` },
      { status: 413 }
    );
  }

  // Dateityp ausschließlich aus dem Inhalt bestimmen. Dateiname und MIME-Typ
  // kommen vom Client und sind frei wählbar – die Dateiendung auf der Platte
  // (und damit der Content-Type bei der Auslieferung) ergibt sich aus den
  // Magic Bytes. Das deckt auch Drag&Drop-Clients ab, die keinen oder einen
  // abweichenden MIME-Typ ("image/jpg") schicken.
  const type = sniffImageType(buffer);
  if (!type || !RASTER_IMAGE_TYPES.has(type)) {
    return NextResponse.json(
      { error: "Nur JPG, PNG, WebP, GIF erlaubt (Dateiinhalt nicht als solches erkannt)" },
      { status: 400 }
    );
  }

  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${type}`;
  const targetDir = path.join(UPLOAD_DIR, safeFolder);

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, safeName), buffer);

  // Auslieferung über eigenen Route Handler (/api/uploads/...) statt rein
  // statischer public/-Auslieferung. Das vermeidet im Dev-Server (Turbopack)
  // negative Caches für frisch geschriebene Dateien, die sonst als 404
  // erscheinen.
  return NextResponse.json({ path: `/api/uploads/${safeFolder}/${safeName}` });
}
