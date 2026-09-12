import { NextRequest, NextResponse } from "next/server";
import { db, boxes } from "@/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { readJsonObject } from "@/lib/request";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await readJsonObject(req);
  if (!body) return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });

  // Nur bekannte Felder in erwarteten Typen übernehmen – wie bei Fächern und
  // Positionen. Vorher wurden alle Body-Felder ungeprüft gesetzt (`label: null`
  // → NOT-NULL-Fehler → 500, leerer Body → "No values to set" → 500).
  const updates: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) updates.label = body.label.trim();
  if (typeof body.imagePath === "string" || body.imagePath === null)
    updates.imagePath = body.imagePath;
  if (typeof body.hotspotX === "number" || body.hotspotX === null) updates.hotspotX = body.hotspotX;
  if (typeof body.hotspotY === "number" || body.hotspotY === null) updates.hotspotY = body.hotspotY;
  if (typeof body.hotspotW === "number" || body.hotspotW === null) updates.hotspotW = body.hotspotW;
  if (typeof body.hotspotH === "number" || body.hotspotH === null) updates.hotspotH = body.hotspotH;
  if (typeof body.sortOrder === "number") updates.sortOrder = body.sortOrder;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });
  }

  const [box] = await db
    .update(boxes)
    .set(updates)
    .where(eq(boxes.id, parseInt(id)))
    .returning();
  if (!box) return NextResponse.json({ error: "Kiste nicht gefunden" }, { status: 404 });
  return NextResponse.json(box);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  await db.delete(boxes).where(eq(boxes.id, parseInt(id)));
  return NextResponse.json({ success: true });
}
