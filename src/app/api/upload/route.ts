import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import path from "path";
import fs from "fs/promises";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Zulässige Bildtypen. Einige Browser/Clients senden für JPEG abweichende
// MIME-Typen (z. B. "image/jpg" statt "image/jpeg", oder bei Drag&Drop leer).
// Wir erlauben daher sowohl eine Whitelist von MIME-Typen als auch einen
// Fallback über die Dateiendung.
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg", // Non-Standard, aber manche Clients nutzen es
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

// Normalisiere Endungen, damit Next.js Image Optimizer die Datei sicher erkennt.
function normalizeExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "jpeg") return "jpg";
  return e;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) || "items";

  if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });

  // Ordner-Whitelist – keine Pfad-Traversal über "folder" zulassen.
  const safeFolder = folder.replace(/[^a-z0-9_-]/gi, "").slice(0, 32) || "items";

  const rawExt = (file.name.split(".").pop() ?? "").toLowerCase();
  const ext = normalizeExt(rawExt);
  const mime = (file.type || "").toLowerCase();

  // Akzeptiere entweder bekannten MIME-Typ ODER bekannte Dateiendung –
  // das behebt den 404/400-Fehler bei JPGs, deren Client "image/jpg" schickt.
  const mimeOk = ALLOWED_MIME.has(mime);
  const extOk = ALLOWED_EXT.has(ext);
  if (!mimeOk && !extOk) {
    return NextResponse.json(
      { error: `Nur JPG, PNG, WebP, GIF erlaubt (erhalten: ${mime || "unbekannt"}/${rawExt || "keine Endung"})` },
      { status: 400 }
    );
  }

  const finalExt = ext || "jpg";
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${finalExt}`;
  const targetDir = path.join(UPLOAD_DIR, safeFolder);

  await fs.mkdir(targetDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(targetDir, safeName), buffer);

  // Auslieferung über eigenen Route Handler (/api/uploads/...) statt rein
  // statischer public/-Auslieferung. Das vermeidet im Dev-Server (Turbopack)
  // negative Caches für frisch geschriebene Dateien, die sonst als 404
  // erscheinen.
  return NextResponse.json({ path: `/api/uploads/${safeFolder}/${safeName}` });
}
