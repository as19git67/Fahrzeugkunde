import { NextRequest, NextResponse } from "next/server";
import { db, items, vehicles } from "@/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { positiveInt, readJsonObject } from "@/lib/request";
import { pickItemFields, validateItemLocation } from "@/lib/item-location";

export async function POST(req: NextRequest) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const body = await readJsonObject(req);
  if (!body) return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });

  const vehicleId = positiveInt(body.vehicleId);
  if (!vehicleId) {
    return NextResponse.json({ error: "vehicleId erforderlich" }, { status: 400 });
  }
  const fields = pickItemFields(body);
  if ("error" in fields) return NextResponse.json({ error: fields.error }, { status: 400 });
  if (!fields.name) return NextResponse.json({ error: "name erforderlich" }, { status: 400 });

  const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId));
  if (!vehicle) return NextResponse.json({ error: "Fahrzeug nicht gefunden" }, { status: 404 });

  // Aufbewahrungsort muss zu diesem Fahrzeug gehören
  const loc = await validateItemLocation(vehicleId, fields.positionId ?? null, fields.boxId ?? null);
  if (!loc.ok) return NextResponse.json({ error: loc.error }, { status: 400 });

  try {
    const [item] = await db
      .insert(items)
      .values({
        vehicleId,
        name: fields.name,
        article: fields.article ?? null,
        plural: fields.plural ?? false,
        imagePath: fields.imagePath ?? null,
        locationImagePath: fields.locationImagePath ?? null,
        silhouettePath: fields.silhouettePath ?? null,
        difficulty: fields.difficulty ?? 1,
        positionId: loc.location.positionId,
        boxId: loc.location.boxId,
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
