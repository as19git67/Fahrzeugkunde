import { NextRequest, NextResponse } from "next/server";
import { db, vehicleViews } from "@/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { nonEmptyString, readJsonObject } from "@/lib/request";

// Muss zur CHECK-Constraint auf vehicle_views.side passen (schema.sql).
const SIDES = new Set(["left", "right", "back", "top", "front"]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicleId = parseInt(id);
  const views = await db
    .select()
    .from(vehicleViews)
    .where(eq(vehicleViews.vehicleId, vehicleId))
    .orderBy(vehicleViews.sortOrder);
  return NextResponse.json(views);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const vehicleId = parseInt(id);
  const body = await readJsonObject(req);
  if (!body) return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });

  const label = nonEmptyString(body.label);
  if (!label) return NextResponse.json({ error: "Label erforderlich" }, { status: 400 });
  if (typeof body.side !== "string" || !SIDES.has(body.side)) {
    return NextResponse.json({ error: "Ungültige Fahrzeugseite" }, { status: 400 });
  }

  const [view] = await db
    .insert(vehicleViews)
    .values({
      vehicleId,
      side: body.side,
      label,
      imagePath: typeof body.imagePath === "string" ? body.imagePath : null,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    })
    .returning();
  return NextResponse.json(view, { status: 201 });
}
