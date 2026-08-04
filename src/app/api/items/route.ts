import { NextRequest, NextResponse } from "next/server";
import { db, items } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  if (!body.vehicleId || !body.name) {
    return NextResponse.json({ error: "vehicleId und name erforderlich" }, { status: 400 });
  }

  try {
    const [item] = await db
      .insert(items)
      .values({
        vehicleId: body.vehicleId,
        name: body.name,
        article: body.article,
        imagePath: body.imagePath,
        locationImagePath: body.locationImagePath,
        silhouettePath: body.silhouettePath,
        difficulty: body.difficulty ?? 1,
        positionId: body.positionId,
        boxId: body.boxId,
      })
      .returning();
    return NextResponse.json(item, { status: 201 });
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
