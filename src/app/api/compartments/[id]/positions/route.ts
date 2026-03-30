import { NextRequest, NextResponse } from "next/server";
import { db, positions } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const compartmentId = parseInt(id);
  const pos = await db
    .select()
    .from(positions)
    .where(eq(positions.compartmentId, compartmentId))
    .orderBy(positions.sortOrder);
  return NextResponse.json(pos);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const compartmentId = parseInt(id);
  const body = await req.json();

  const [pos] = await db
    .insert(positions)
    .values({
      compartmentId,
      label: body.label,
      hotspotX: body.hotspotX,
      hotspotY: body.hotspotY,
      hotspotW: body.hotspotW,
      hotspotH: body.hotspotH,
      sortOrder: body.sortOrder ?? 0,
    })
    .returning();
  return NextResponse.json(pos, { status: 201 });
}
