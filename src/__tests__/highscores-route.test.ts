/**
 * Tests für /api/highscores: Eingaben werden validiert, der Name kommt nur aus
 * der Session, unplausible Scores werden abgelehnt.
 */
import { it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { getTestDb, getTestPool, cleanDb, closeDb, describeDb as describe } from "./db-helper";
import { users, vehicles } from "@/db/schema";
import { MAX_SCORE_PER_CORRECT_ANSWER } from "@/lib/scoring";

process.env.DATABASE_URL =
  process.env.POSTGRES_TEST_CONNECTION_STRING || process.env.DATABASE_URL;

const cookie = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookie.token ? { name, value: cookie.token } : undefined),
  }),
}));

const testDb = getTestDb();
let route: typeof import("@/app/api/highscores/route");
let userToken: string;
let vehicleId: number;

const validBody = () => ({
  score: 1200,
  mode: "time_attack",
  correctAnswers: 8,
  totalAnswers: 10,
  durationSeconds: 60,
});

async function post(body: unknown, raw = false) {
  const res = await route.POST(
    new NextRequest("http://localhost/api/highscores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ? (body as string) : JSON.stringify(body),
    })
  );
  return { status: res.status, body: await res.json() };
}

async function get(query = "") {
  const res = await route.GET(new NextRequest(`http://localhost/api/highscores${query}`));
  return { status: res.status, body: await res.json() };
}

describe("/api/highscores", () => {
  beforeAll(async () => {
    route = await import("@/app/api/highscores/route");
    const auth = await import("@/lib/auth");
    await cleanDb();
    const [u] = await testDb
      .insert(users)
      .values({ handle: "Blaulicht", email: "b@test.de" })
      .returning();
    userToken = await auth.createSession(u.id);
    const [v] = await testDb.insert(vehicles).values({ name: "HLF" }).returning();
    vehicleId = v.id;
  });

  beforeEach(async () => {
    cookie.token = null;
    await (await getTestPool()).query("DELETE FROM highscores");
  });

  afterAll(async () => {
    await cleanDb();
    await closeDb();
  });

  it("speichert anonym als „Anonym“ – ein Handle im Body wird ignoriert", async () => {
    const { status, body } = await post({ ...validBody(), handle: "Hacker", vehicleId });
    expect(status).toBe(201);
    expect(body.handle).toBe("Anonym");
    expect(body.userId).toBeNull();
    expect(body.vehicleId).toBe(vehicleId);
  });

  it("nimmt den Namen aus der Session", async () => {
    cookie.token = userToken;
    const { status, body } = await post({ ...validBody(), handle: "Hacker" });
    expect(status).toBe(201);
    expect(body.handle).toBe("Blaulicht");
    expect(body.userId).toBeGreaterThan(0);
  });

  it("lehnt ungültige Typen, negative Werte und fehlende Felder ab", async () => {
    expect((await post({ ...validBody(), score: "1200" })).status).toBe(400);
    expect((await post({ ...validBody(), score: -1 })).status).toBe(400);
    expect((await post({ ...validBody(), score: 1.5 })).status).toBe(400);
    expect((await post({ ...validBody(), correctAnswers: undefined })).status).toBe(400);
    expect((await post("nicht json", true)).status).toBe(400);
    expect((await post([1, 2, 3])).status).toBe(400);
  });

  it("lehnt unbekannte Modi ab", async () => {
    expect((await post({ ...validBody(), mode: "gottmodus" })).status).toBe(400);
    expect((await post({ ...validBody(), mode: "speed_run" })).status).toBe(201);
  });

  it("lehnt unplausible Spielwerte ab", async () => {
    // mehr richtige als gesamt
    expect((await post({ ...validBody(), correctAnswers: 11, totalAnswers: 10 })).status).toBe(400);
    // Score über dem theoretischen Maximum
    const tooHigh = 8 * MAX_SCORE_PER_CORRECT_ANSWER + 1;
    expect((await post({ ...validBody(), score: tooHigh })).status).toBe(400);
    expect((await post({ ...validBody(), score: tooHigh - 1 })).status).toBe(201);
    // 0 richtige → nur Score 0 erlaubt
    expect((await post({ ...validBody(), correctAnswers: 0, score: 1 })).status).toBe(400);
    expect((await post({ ...validBody(), correctAnswers: 0, score: 0 })).status).toBe(201);
    // absurde Dauer / Anzahl
    expect((await post({ ...validBody(), durationSeconds: 999999 })).status).toBe(400);
    expect((await post({ ...validBody(), totalAnswers: 5000, correctAnswers: 5000 })).status).toBe(400);
  });

  it("lehnt eine unbekannte vehicleId mit 400 statt 500 ab, erlaubt null", async () => {
    expect((await post({ ...validBody(), vehicleId: 999999 })).status).toBe(400);
    expect((await post({ ...validBody(), vehicleId: "abc" })).status).toBe(400);
    const { status, body } = await post({ ...validBody(), vehicleId: null });
    expect(status).toBe(201);
    expect(body.vehicleId).toBeNull();
  });

  it("GET: validiert Filter und klemmt limit auf 1..100", async () => {
    for (let i = 0; i < 3; i++) await post({ ...validBody(), score: 100 * (i + 1) });
    expect((await get("?mode=foo")).status).toBe(400);
    expect((await get("?vehicleId=abc")).status).toBe(400);
    expect((await get("?limit=abc")).body).toHaveLength(3);
    expect((await get("?limit=2")).body).toHaveLength(2);
    expect((await get("?limit=0")).body).toHaveLength(1);
    expect((await get("?limit=100000")).status).toBe(200);
    // sortiert absteigend nach Score, ohne E-Mail/User-Daten
    const { body } = await get("?mode=time_attack");
    expect(body.map((e: { score: number }) => e.score)).toEqual([300, 200, 100]);
    expect(Object.keys(body[0])).not.toContain("userId");
  });
});
