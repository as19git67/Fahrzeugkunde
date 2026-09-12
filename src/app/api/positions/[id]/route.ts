import { NextRequest, NextResponse } from "next/server";
import { db, positions } from "@/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { readJsonObject } from "@/lib/request";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await readJsonObject(req);
  if (!body) return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) updates.label = body.label.trim();
  if (typeof body.hotspotX === "number" || body.hotspotX === null) updates.hotspotX = body.hotspotX;
  if (typeof body.hotspotY === "number" || body.hotspotY === null) updates.hotspotY = body.hotspotY;
  if (typeof body.hotspotW === "number" || body.hotspotW === null) updates.hotspotW = body.hotspotW;
  if (typeof body.hotspotH === "number" || body.hotspotH === null) updates.hotspotH = body.hotspotH;
  if (typeof body.sortOrder === "number") updates.sortOrder = body.sortOrder;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });
  }

  const [pos] = await db
    .update(positions)
    .set(updates)
    .where(eq(positions.id, parseInt(id)))
    .returning();
  return NextResponse.json(pos);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  await db.delete(positions).where(eq(positions.id, parseInt(id)));
  return NextResponse.json({ success: true });
}
