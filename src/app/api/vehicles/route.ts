import { NextRequest, NextResponse } from "next/server";
import { db, vehicles, vehicleViews, compartments, positions, items } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const all = await db.select().from(vehicles);
  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { name, description } = await req.json();
  if (!name) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });

  const [vehicle] = await db.insert(vehicles).values({ name, description }).returning();
  return NextResponse.json(vehicle, { status: 201 });
}
