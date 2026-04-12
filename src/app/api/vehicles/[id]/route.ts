import { NextRequest, NextResponse } from "next/server";
import { db, vehicles, vehicleViews, compartments, positions, items } from "@/db";
import { eq, sql } from "drizzle-orm";

// Gibt komplette Fahrzeugstruktur zurück (Views → Compartments → Positions → Items)
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
