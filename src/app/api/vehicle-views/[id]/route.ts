import { NextRequest, NextResponse } from "next/server";
import { db, vehicleViews } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.label === "string") updates.label = body.label;
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
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  await db.delete(vehicleViews).where(eq(vehicleViews.id, parseInt(id)));
  return NextResponse.json({ success: true });
}
