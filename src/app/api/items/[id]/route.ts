import { NextRequest, NextResponse } from "next/server";
import { db, items } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const [item] = await db
    .update(items)
    .set({
      name: body.name,
      description: body.description,
      imagePath: body.imagePath,
      silhouettePath: body.silhouettePath,
      category: body.category,
      difficulty: body.difficulty,
      positionId: body.positionId,
      locationLabel: body.locationLabel,
    })
    .where(eq(items.id, parseInt(id)))
    .returning();
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  await db.delete(items).where(eq(items.id, parseInt(id)));
  return NextResponse.json({ success: true });
}
