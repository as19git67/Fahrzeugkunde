import { NextRequest, NextResponse } from "next/server";
import { db, compartments } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const [comp] = await db
    .update(compartments)
    .set({
      label: body.label,
      imagePath: body.imagePath,
      hotspotX: body.hotspotX,
      hotspotY: body.hotspotY,
      hotspotW: body.hotspotW,
      hotspotH: body.hotspotH,
      sortOrder: body.sortOrder,
    })
    .where(eq(compartments.id, parseInt(id)))
    .returning();
  return NextResponse.json(comp);
}
