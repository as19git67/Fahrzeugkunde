import { NextRequest, NextResponse } from "next/server";
import { db, boxes } from "@/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { nonEmptyString, readJsonObject } from "@/lib/request";

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
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const positionId = parseInt(id);
  const body = await readJsonObject(req);
  if (!body) return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });

  const label = nonEmptyString(body.label);
  if (!label) return NextResponse.json({ error: "Label erforderlich" }, { status: 400 });

  const num = (v: unknown) => (typeof v === "number" ? v : null);
  const [box] = await db
    .insert(boxes)
    .values({
      positionId,
      label,
      imagePath: typeof body.imagePath === "string" ? body.imagePath : null,
      hotspotX: num(body.hotspotX),
      hotspotY: num(body.hotspotY),
      hotspotW: num(body.hotspotW),
      hotspotH: num(body.hotspotH),
      sortOrder: num(body.sortOrder) ?? 0,
    })
    .returning();
  return NextResponse.json(box, { status: 201 });
}
