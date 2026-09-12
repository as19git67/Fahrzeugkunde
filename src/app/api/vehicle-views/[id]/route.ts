import { NextRequest, NextResponse } from "next/server";
import { db, vehicleViews } from "@/db";
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
  if (typeof body.imagePath === "string" || body.imagePath === null)
    updates.imagePath = body.imagePath;
  if (typeof body.sortOrder === "number") updates.sortOrder = body.sortOrder;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });
  }

  const [view] = await db
    .update(vehicleViews)
    .set(updates)
    .where(eq(vehicleViews.id, parseInt(id)))
    .returning();
  return NextResponse.json(view);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  await db.delete(vehicleViews).where(eq(vehicleViews.id, parseInt(id)));
  return NextResponse.json({ success: true });
}
