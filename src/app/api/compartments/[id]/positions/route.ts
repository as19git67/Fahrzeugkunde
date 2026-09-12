import { NextRequest, NextResponse } from "next/server";
import { db, positions } from "@/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { nonEmptyString, readJsonObject } from "@/lib/request";

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
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const compartmentId = parseInt(id);
  const body = await readJsonObject(req);
  if (!body) return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });

  const label = nonEmptyString(body.label);
  if (!label) return NextResponse.json({ error: "Label erforderlich" }, { status: 400 });

  const num = (v: unknown) => (typeof v === "number" ? v : null);
  const [pos] = await db
    .insert(positions)
    .values({
      compartmentId,
      label,
      hotspotX: num(body.hotspotX),
      hotspotY: num(body.hotspotY),
      hotspotW: num(body.hotspotW),
      hotspotH: num(body.hotspotH),
      sortOrder: num(body.sortOrder) ?? 0,
    })
    .returning();
  return NextResponse.json(pos, { status: 201 });
}
