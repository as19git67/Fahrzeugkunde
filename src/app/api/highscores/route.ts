import { NextRequest, NextResponse } from "next/server";
import { db, highscores } from "@/db";
import { and, desc, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");
  const vehicleId = searchParams.get("vehicleId");
  const limit = parseInt(searchParams.get("limit") || "10");

  const filters = [];
  if (mode) filters.push(eq(highscores.mode, mode));
  if (vehicleId) filters.push(eq(highscores.vehicleId, parseInt(vehicleId)));

  const results = await db
    .select({
      id: highscores.id,
      handle: highscores.handle,
      score: highscores.score,
      mode: highscores.mode,
      correctAnswers: highscores.correctAnswers,
      totalAnswers: highscores.totalAnswers,
      durationSeconds: highscores.durationSeconds,
      createdAt: highscores.createdAt,
    })
    .from(highscores)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(highscores.score))
    .limit(limit);

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();

  const body = await req.json();
  const { score, mode, correctAnswers, totalAnswers, durationSeconds, vehicleId } = body;

  if (score == null || !mode || correctAnswers == null || totalAnswers == null || durationSeconds == null) {
    return NextResponse.json({ error: "Fehlende Felder" }, { status: 400 });
  }

  const handle = user?.handle ?? body.handle ?? "Anonym";

  const [entry] = await db
    .insert(highscores)
    .values({
      userId: user?.id,
      handle,
      score,
      mode,
      correctAnswers,
      totalAnswers,
      durationSeconds,
      vehicleId,
    })
    .returning();

  return NextResponse.json(entry, { status: 201 });
}
