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

  const [item] = await db
    .insert(items)
    .values({
      vehicleId: body.vehicleId,
      name: body.name,
      description: body.description,
      imagePath: body.imagePath,
      silhouettePath: body.silhouettePath,
      category: body.category,
      difficulty: body.difficulty ?? 1,
      positionId: body.positionId,
      boxId: body.boxId,
      locationLabel: body.locationLabel,
    })
    .returning();
  return NextResponse.json(item, { status: 201 });
}
