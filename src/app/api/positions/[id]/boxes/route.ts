import { NextRequest, NextResponse } from "next/server";
import { db, boxes } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const positionId = parseInt(id);
  const rows = await db
    .select()
    .from(boxes)
    .where(eq(boxes.positionId, positionId))
    .orderBy(boxes.sortOrder);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const positionId = parseInt(id);
  const body = await req.json();

  const [box] = await db
    .insert(boxes)
    .values({
      positionId,
      label: body.label,
      imagePath: body.imagePath,
      hotspotX: body.hotspotX,
      hotspotY: body.hotspotY,
      hotspotW: body.hotspotW,
      hotspotH: body.hotspotH,
      sortOrder: body.sortOrder ?? 0,
    })
    .returning();
  return NextResponse.json(box, { status: 201 });
}
