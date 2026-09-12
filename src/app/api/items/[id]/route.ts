import { NextRequest, NextResponse } from "next/server";
import { db, items } from "@/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { intParam, readJsonObject } from "@/lib/request";
import { pickItemFields, validateItemLocation } from "@/lib/item-location";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const itemId = intParam(id);
  if (!itemId) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  const [existing] = await db.select().from(items).where(eq(items.id, itemId));
  if (!existing) {
    return NextResponse.json({ error: "Gegenstand nicht gefunden" }, { status: 404 });
  }

  const body = await readJsonObject(req);
  if (!body) return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  const fields = pickItemFields(body);
  if ("error" in fields) return NextResponse.json({ error: fields.error }, { status: 400 });

  const { positionId, boxId, ...rest } = fields;
  const updates: Record<string, unknown> = { ...rest };

  // Aufbewahrungsort nur prüfen, wenn er im Body vorkommt. Er muss zum
  // Fahrzeug des Gegenstands gehören – das Fahrzeug selbst ist nicht änderbar.
  if (positionId !== undefined || boxId !== undefined) {
    const loc = await validateItemLocation(
      existing.vehicleId,
      positionId !== undefined ? positionId : existing.positionId,
      boxId !== undefined ? boxId : existing.boxId
    );
    if (!loc.ok) return NextResponse.json({ error: loc.error }, { status: 400 });
    updates.positionId = loc.location.positionId;
    updates.boxId = loc.location.boxId;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });
  }

  try {
    const [item] = await db.update(items).set(updates).where(eq(items.id, itemId)).returning();
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
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  await db.delete(items).where(eq(items.id, parseInt(id)));
  return NextResponse.json({ success: true });
}
