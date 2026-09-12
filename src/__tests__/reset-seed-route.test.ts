/**
 * POST /api/admin/reset-seed: Admin-Pflicht, vollständiger Neuaufbau des
 * Demo-Fahrzeugs, Idempotenz – und vor allem Atomarität: Scheitert der Seed
 * mittendrin, bleibt der alte Stand erhalten (vorher blieb ein halbes
 * Fahrzeug zurück).
 */
import { it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, closeDb, describeDb as describe } from "./db-helper";
import { users, vehicles, items } from "@/db/schema";

process.env.DATABASE_URL =
  process.env.POSTGRES_TEST_CONNECTION_STRING || process.env.DATABASE_URL;

const cookie = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookie.token ? { name, value: cookie.token } : undefined),
  }),
}));

// Seed-Funktion durchreichen, aber mock-bar machen (Fehlerfall simulieren)
vi.mock("@/db/seed-data", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/db/seed-data")>();
  return { ...mod, seedDemoVehicle: vi.fn(mod.seedDemoVehicle) };
});

import { seedDemoVehicle } from "@/db/seed-data";

const testDb = getTestDb();
let route: typeof import("@/app/api/admin/reset-seed/route");
let adminToken: string;
let userToken: string;

async function counts() {
  const vs = await testDb.select().from(vehicles);
  const its = await testDb.select().from(items);
  return { vehicles: vs.map((v) => v.name), items: its.length };
}

describe("POST /api/admin/reset-seed", () => {
  beforeAll(async () => {
    route = await import("@/app/api/admin/reset-seed/route");
    const auth = await import("@/lib/auth");
    await cleanDb();
    const [admin] = await testDb
      .insert(users)
      .values({ handle: "Admin", email: "admin@test.de", role: "admin" })
      .returning();
    const [plain] = await testDb
      .insert(users)
      .values({ handle: "Spieler", email: "user@test.de" })
      .returning();
    adminToken = await auth.createSession(admin.id);
    userToken = await auth.createSession(plain.id);
  });

  afterAll(async () => {
    cookie.token = null;
    await cleanDb();
    await closeDb();
  });

  it("verlangt einen Admin (401 / 403)", async () => {
    cookie.token = null;
    expect((await route.POST()).status).toBe(401);
    cookie.token = userToken;
    expect((await route.POST()).status).toBe(403);
  });

  it("ersetzt vorhandene Fahrzeugdaten durch das komplette Demo-Fahrzeug", async () => {
    const [alt] = await testDb.insert(vehicles).values({ name: "Altes Fahrzeug" }).returning();
    await testDb.insert(items).values({ vehicleId: alt.id, name: "Altlast" });

    cookie.token = adminToken;
    const res = await route.POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.itemCount).toBe(102);

    const after = await counts();
    expect(after.vehicles).toEqual(["HLF 20"]);
    expect(after.items).toBe(102);
  });

  it("ist idempotent – ein zweiter Reset ergibt denselben Stand", async () => {
    cookie.token = adminToken;
    expect((await route.POST()).status).toBe(200);
    const after = await counts();
    expect(after.vehicles).toEqual(["HLF 20"]);
    expect(after.items).toBe(102);
  });

  it("lässt bei einem Fehler mitten im Seed den alten Stand unangetastet (Transaktion)", async () => {
    // Ausgangslage: das HLF 20 aus dem vorigen Test, dazu ein Marker-Item
    const [hlf] = await testDb.select().from(vehicles);
    await testDb.insert(items).values({ vehicleId: hlf.id, name: "Marker vor dem Fehler" });
    const before = await counts();
    expect(before.items).toBe(103);

    vi.mocked(seedDemoVehicle).mockRejectedValueOnce(new Error("Seed kaputt (simuliert)"));
    cookie.token = adminToken;
    const res = await route.POST();
    expect(res.status).toBe(500);

    // Weder gelöscht noch halb neu angelegt: exakt der Stand von vorher
    expect(await counts()).toEqual(before);
    const marker = await testDb.select().from(items).where(eq(items.name, "Marker vor dem Fehler"));
    expect(marker).toHaveLength(1);
  });
});
