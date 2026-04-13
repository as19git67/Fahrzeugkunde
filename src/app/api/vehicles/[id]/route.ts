import { NextRequest, NextResponse } from "next/server";
import { db, vehicles, vehicleViews, compartments, positions, boxes, items } from "@/db";
import { eq, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

// Gibt komplette Fahrzeugstruktur zurück (Views → Compartments → Positions → Boxes → Items)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicleId = parseInt(id);

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
  if (!vehicle) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const views = await db
    .select()
    .from(vehicleViews)
    .where(eq(vehicleViews.vehicleId, vehicleId))
    .orderBy(vehicleViews.sortOrder);

  // Alle Daten für dieses Fahrzeug laden
  const viewIds = views.map((v) => v.id);
  const vehicleComps =
    viewIds.length > 0
      ? await db
          .select()
          .from(compartments)
          .where(sql`${compartments.viewId} IN (${sql.join(viewIds, sql`, `)})`)
          .orderBy(compartments.sortOrder)
      : [];
  const compIds = vehicleComps.map((c) => c.id);

  const vehiclePositions =
    compIds.length > 0
      ? await db
          .select()
          .from(positions)
          .where(sql`${positions.compartmentId} IN (${sql.join(compIds, sql`, `)})`)
          .orderBy(positions.sortOrder)
      : [];
  const posIds = vehiclePositions.map((p) => p.id);

  const vehicleBoxes =
    posIds.length > 0
      ? await db
          .select()
          .from(boxes)
          .where(sql`${boxes.positionId} IN (${sql.join(posIds, sql`, `)})`)
          .orderBy(boxes.sortOrder)
      : [];

  const vehicleItems = await db.select().from(items).where(eq(items.vehicleId, vehicleId));

  return NextResponse.json({
    ...vehicle,
    views: views.map((v) => ({
      ...v,
      compartments: vehicleComps
        .filter((c) => c.viewId === v.id)
        .map((c) => ({
          ...c,
          positions: vehiclePositions
            .filter((p) => p.compartmentId === c.id)
            .map((p) => ({
              ...p,
              boxes: vehicleBoxes
                .filter((b) => b.positionId === p.id)
                .map((b) => ({
                  ...b,
                  items: vehicleItems.filter((i) => i.boxId === b.id),
                })),
              items: vehicleItems.filter((i) => i.positionId === p.id && !i.boxId),
            })),
        })),
    })),
    items: vehicleItems,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.description === "string" || body.description === null)
    updates.description = body.description;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });
  }

  const [vehicle] = await db
    .update(vehicles)
    .set(updates)
    .where(eq(vehicles.id, parseInt(id)))
    .returning();

  if (!vehicle) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(vehicle);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  await db.delete(vehicles).where(eq(vehicles.id, parseInt(id)));
  return NextResponse.json({ success: true });
}
