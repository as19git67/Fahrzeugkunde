import { NextRequest, NextResponse } from "next/server";
import { db, compartments } from "@/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { nonEmptyString, readJsonObject } from "@/lib/request";

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
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const viewId = parseInt(id);
  const body = await readJsonObject(req);
  if (!body) return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });

  const label = nonEmptyString(body.label);
  if (!label) return NextResponse.json({ error: "Label erforderlich" }, { status: 400 });

  const num = (v: unknown) => (typeof v === "number" ? v : null);
  const [comp] = await db
    .insert(compartments)
    .values({
      viewId,
      label,
      imagePath: typeof body.imagePath === "string" ? body.imagePath : null,
      hotspotX: num(body.hotspotX),
      hotspotY: num(body.hotspotY),
      hotspotW: num(body.hotspotW),
      hotspotH: num(body.hotspotH),
      sortOrder: num(body.sortOrder) ?? 0,
    })
    .returning();
  return NextResponse.json(comp, { status: 201 });
}
