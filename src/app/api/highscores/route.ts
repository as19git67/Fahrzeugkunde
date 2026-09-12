import { NextRequest, NextResponse } from "next/server";
import { db, highscores, vehicles } from "@/db";
import { and, desc, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import {
  calculateSpeedRunResult,
  GAME_MODES,
  MAX_SCORE_PER_CORRECT_ANSWER,
  MIN_SECONDS_PER_ANSWER,
  SPEED_RUN_TARGET,
  TIME_ATTACK_DURATION,
} from "@/lib/scoring";
import { intParam, nonNegativeInt, positiveInt, readJsonObject } from "@/lib/request";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const MAX_ANSWERS = 1000;
const MAX_DURATION_SECONDS = 24 * 60 * 60;

function isGameMode(value: unknown): value is (typeof GAME_MODES)[number] {
  return typeof value === "string" && (GAME_MODES as readonly string[]).includes(value);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");
  const vehicleIdRaw = searchParams.get("vehicleId");
  const limitRaw = searchParams.get("limit");

  if (mode !== null && !isGameMode(mode)) {
    return NextResponse.json({ error: "Ungültiger Modus" }, { status: 400 });
  }
  const vehicleId = vehicleIdRaw !== null ? intParam(vehicleIdRaw) : null;
  if (vehicleIdRaw !== null && vehicleId === null) {
    return NextResponse.json({ error: "Ungültige vehicleId" }, { status: 400 });
  }
  // Unlesbares limit → Default; lesbares wird auf 1..MAX_LIMIT geklemmt.
  const limit = Math.min(MAX_LIMIT, Math.max(1, intParam(limitRaw, 0) ?? DEFAULT_LIMIT));

  const filters = [];
  if (mode) filters.push(eq(highscores.mode, mode));
  if (vehicleId !== null) filters.push(eq(highscores.vehicleId, vehicleId));

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

  const body = await readJsonObject(req);
  if (!body) return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });

  let score = nonNegativeInt(body.score);
  const correctAnswers = nonNegativeInt(body.correctAnswers);
  const totalAnswers = nonNegativeInt(body.totalAnswers);
  const durationSeconds = nonNegativeInt(body.durationSeconds);
  if (score === null || correctAnswers === null || totalAnswers === null || durationSeconds === null) {
    return NextResponse.json({ error: "Fehlende oder ungültige Felder" }, { status: 400 });
  }
  if (!isGameMode(body.mode)) {
    return NextResponse.json({ error: "Ungültiger Modus" }, { status: 400 });
  }
  if (correctAnswers > totalAnswers || totalAnswers > MAX_ANSWERS || durationSeconds > MAX_DURATION_SECONDS) {
    return NextResponse.json({ error: "Unplausible Spielwerte" }, { status: 400 });
  }

  if (body.mode === "speed_run") {
    // Speed-Run wird nach Zeit gewertet: Ein Lauf ist erst mit dem Ziel
    // beendet, und schneller als MIN_SECONDS_PER_ANSWER je Antwort geht nicht.
    // Der Score wird hier aus Zeit und Fehlern neu berechnet – der Client-
    // Wert wird ignoriert, damit er nicht gefälscht werden kann.
    if (correctAnswers !== SPEED_RUN_TARGET) {
      return NextResponse.json(
        { error: `Speed-Run ist erst mit ${SPEED_RUN_TARGET} richtigen Antworten beendet` },
        { status: 400 }
      );
    }
    if (durationSeconds < totalAnswers * MIN_SECONDS_PER_ANSWER) {
      return NextResponse.json({ error: "Unplausible Spieldauer" }, { status: 400 });
    }
    score = calculateSpeedRunResult({ durationSeconds, correctAnswers, totalAnswers }).score;
  } else {
    // Time-Attack: Dauer ist fix (kleine Toleranz für das letzte Feedback);
    // der Score wird im Client berechnet und ist frei fälschbar – mehr als das
    // theoretische Maximum pro richtiger Antwort kann kein Spiel einbringen.
    if (durationSeconds > TIME_ATTACK_DURATION + 5) {
      return NextResponse.json({ error: "Unplausible Spieldauer" }, { status: 400 });
    }
    if (score > correctAnswers * MAX_SCORE_PER_CORRECT_ANSWER) {
      return NextResponse.json({ error: "Unplausibler Score" }, { status: 400 });
    }
  }

  let vehicleId: number | null = null;
  if (body.vehicleId !== undefined && body.vehicleId !== null) {
    vehicleId = positiveInt(body.vehicleId);
    if (vehicleId === null) {
      return NextResponse.json({ error: "Ungültige vehicleId" }, { status: 400 });
    }
    const [v] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId));
    if (!v) return NextResponse.json({ error: "Fahrzeug existiert nicht" }, { status: 400 });
  }

  // Der angezeigte Name kommt ausschließlich aus der Session – nie aus dem
  // Body, sonst ließen sich Einträge unter fremdem Namen anlegen.
  const handle = user?.handle ?? "Anonym";

  const [entry] = await db
    .insert(highscores)
    .values({
      userId: user?.id,
      handle,
      score,
      mode: body.mode,
      correctAnswers,
      totalAnswers,
      durationSeconds,
      vehicleId,
    })
    .returning();

  return NextResponse.json(entry, { status: 201 });
}
