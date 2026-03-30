import { NextRequest, NextResponse } from "next/server";
import { db, vehicleViews, compartments, positions } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

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
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const vehicleId = parseInt(id);
  const body = await req.json();

  const [view] = await db
    .insert(vehicleViews)
    .values({
      vehicleId,
      side: body.side,
      label: body.label,
      imagePath: body.imagePath,
      sortOrder: body.sortOrder ?? 0,
    })
    .returning();
  return NextResponse.json(view, { status: 201 });
}
