import { NextRequest, NextResponse } from "next/server";
import { db, vehicles } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { nonEmptyString, readJsonObject } from "@/lib/request";

export async function GET() {
  const all = await db.select().from(vehicles);
  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const body = await readJsonObject(req);
  if (!body) return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  const name = nonEmptyString(body.name);
  if (!name) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });
  const description = typeof body.description === "string" ? body.description : null;

  const [vehicle] = await db.insert(vehicles).values({ name, description }).returning();
  return NextResponse.json(vehicle, { status: 201 });
}
