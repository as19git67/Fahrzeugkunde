import { NextRequest, NextResponse } from "next/server";
import { db, compartments } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewId = parseInt(id);
  const comps = await db
    .select()
    .from(compartments)
    .where(eq(compartments.viewId, viewId))
    .orderBy(compartments.sortOrder);
  return NextResponse.json(comps);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const viewId = parseInt(id);
  const body = await req.json();

  const [comp] = await db
    .insert(compartments)
    .values({
      viewId,
      label: body.label,
      imagePath: body.imagePath,
      hotspotX: body.hotspotX,
      hotspotY: body.hotspotY,
      hotspotW: body.hotspotW,
      hotspotH: body.hotspotH,
      sortOrder: body.sortOrder ?? 0,
    })
    .returning();
  return NextResponse.json(comp, { status: 201 });
}
