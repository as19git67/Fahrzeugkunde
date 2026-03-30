import { NextRequest, NextResponse } from "next/server";
import { db, vehicleViews } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const [view] = await db
    .update(vehicleViews)
    .set({
      label: body.label,
      imagePath: body.imagePath,
      sortOrder: body.sortOrder,
    })
    .where(eq(vehicleViews.id, parseInt(id)))
    .returning();
  return NextResponse.json(view);
}
