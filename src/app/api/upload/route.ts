import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import path from "path";
import fs from "fs/promises";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) || "items";

  if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Nur JPG, PNG, WebP, GIF erlaubt" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const targetDir = path.join(UPLOAD_DIR, folder);

  await fs.mkdir(targetDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(targetDir, safeName), buffer);

  return NextResponse.json({ path: `/uploads/${folder}/${safeName}` });
}
