import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

// Serviert hochgeladene Dateien zuverlässig – unabhängig davon, ob der
// Next.js-Dev-Server (Turbopack) die frisch geschriebene Datei unter
// /uploads/... bereits kennt. Das behebt gelegentliche 404-Fehler beim
// Hochladen von z.B. JPGs.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segs } = await params;
  if (!segs || segs.length === 0) {
    return NextResponse.json({ error: "Kein Pfad" }, { status: 400 });
  }

  // Pfad-Traversal unterbinden.
  for (const s of segs) {
    if (s.includes("..") || s.includes("/") || s.includes("\\") || s.startsWith(".")) {
      return NextResponse.json({ error: "Ungültiger Pfad" }, { status: 400 });
    }
  }

  const fullPath = path.join(UPLOAD_DIR, ...segs);
  // Sicherheits-Check: resultierender Pfad muss innerhalb UPLOAD_DIR liegen.
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
    return NextResponse.json({ error: "Ungültiger Pfad" }, { status: 400 });
  }

  let data: Buffer;
  try {
    data = await fs.readFile(resolved);
  } catch {
    return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
  }

  const ext = (resolved.split(".").pop() ?? "").toLowerCase();
  const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
