import { NextRequest, NextResponse } from "next/server";
import { db, items } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  try {
    const [item] = await db
      .update(items)
      .set({
        name: body.name,
        article: body.article,
        imagePath: body.imagePath,
        locationImagePath: body.locationImagePath,
        silhouettePath: body.silhouettePath,
        difficulty: body.difficulty,
        positionId: body.positionId,
        boxId: body.boxId,
      })
      .where(eq(items.id, parseInt(id)))
      .returning();
    if (!item) {
      return NextResponse.json({ error: "Gegenstand nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "23503") {
      return NextResponse.json(
        { error: "Position oder Kiste existiert nicht mehr. Bitte Aufbewahrungsort neu auswählen." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  await db.delete(items).where(eq(items.id, parseInt(id)));
  return NextResponse.json({ success: true });
}
