import { NextRequest, NextResponse } from "next/server";
import { db, positions } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.label === "string") updates.label = body.label;
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
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  await db.delete(positions).where(eq(positions.id, parseInt(id)));
  return NextResponse.json({ success: true });
}
