import { NextRequest, NextResponse } from "next/server";
import { db, vehicles, vehicleViews, compartments, positions, items } from "@/db";
import { eq } from "drizzle-orm";

// Gibt komplette Fahrzeugstruktur zurück (Views → Compartments → Positions → Items)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicleId = parseInt(id);

  const vehicle = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).get();
  if (!vehicle) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const views = await db
    .select()
    .from(vehicleViews)
    .where(eq(vehicleViews.vehicleId, vehicleId))
    .orderBy(vehicleViews.sortOrder);

  const allCompartments = await db
    .select()
    .from(compartments)
    .where(
      eq(
        compartments.viewId,
        db
          .select({ id: vehicleViews.id })
          .from(vehicleViews)
          .where(eq(vehicleViews.vehicleId, vehicleId))
          .limit(1)
          .as("sub")
          .id
      )
    );

  // Einfacher: alle Daten separat laden und zusammenführen
  const viewIds = views.map((v) => v.id);
  const allComps =
    viewIds.length > 0
      ? await db
          .select()
          .from(compartments)
          .where(sql`${compartments.viewId} IN (${sql.join(viewIds, sql`, `)})`)
          .orderBy(compartments.sortOrder)
      : [];
  const vehicleComps = allComps.filter((c) => viewIds.includes(c.viewId));
  const compIds = vehicleComps.map((c) => c.id);

  const allPositions = compIds.length > 0 ? await db.select().from(positions).orderBy(positions.sortOrder) : [];
  const vehiclePositions = allPositions.filter((p) => compIds.includes(p.compartmentId));

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
              items: vehicleItems.filter((i) => i.positionId === p.id),
            })),
        })),
    })),
    items: vehicleItems,
  });
}
