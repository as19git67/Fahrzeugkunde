/**
 * Integrationstests für den Admin-Guard: `requireAdmin` und die mutierenden
 * Creator-Routen lehnen normale Nutzer ab (403) und Nicht-Eingeloggte (401).
 *
 * Das Session-Cookie wird über einen Mock von `next/headers` gesetzt; Sessions
 * und Nutzer liegen echt in der Test-DB.
 */
import { it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, closeDb, describeDb as describe } from "./db-helper";
import { users, vehicles } from "@/db/schema";

// Siehe questions-route.test.ts: `@/db` liest DATABASE_URL beim ersten Import.
process.env.DATABASE_URL =
  process.env.POSTGRES_TEST_CONNECTION_STRING || process.env.DATABASE_URL;

const cookie = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookie.token ? { name, value: cookie.token } : undefined),
  }),
}));

const testDb = getTestDb();
let auth: typeof import("@/lib/auth");
let vehiclesRoute: typeof import("@/app/api/vehicles/route");
let vehicleRoute: typeof import("@/app/api/vehicles/[id]/route");
let itemRoute: typeof import("@/app/api/items/[id]/route");
let adminToken: string;
let userToken: string;

const json = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const params = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });

describe("requireAdmin und mutierende Routen", () => {
  beforeAll(async () => {
    auth = await import("@/lib/auth");
    vehiclesRoute = await import("@/app/api/vehicles/route");
    vehicleRoute = await import("@/app/api/vehicles/[id]/route");
    itemRoute = await import("@/app/api/items/[id]/route");

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

  it("requireAdmin: 401 ohne Session, 403 als Nutzer, Durchlass als Admin", async () => {
    cookie.token = null;
    expect((await auth.requireAdmin()).denied?.status).toBe(401);
    cookie.token = "gibt-es-nicht";
    expect((await auth.requireAdmin()).denied?.status).toBe(401);
    cookie.token = userToken;
    expect((await auth.requireAdmin()).denied?.status).toBe(403);
    cookie.token = adminToken;
    const ok = await auth.requireAdmin();
    expect(ok.denied).toBeNull();
    expect(ok.user?.handle).toBe("Admin");
  });

  it("POST /api/vehicles: Nutzer 403 (nichts angelegt), Admin 201", async () => {
    cookie.token = userToken;
    const denied = await vehiclesRoute.POST(json("/api/vehicles", "POST", { name: "Fremd" }));
    expect(denied.status).toBe(403);
    expect(await testDb.select().from(vehicles)).toHaveLength(0);

    cookie.token = adminToken;
    const created = await vehiclesRoute.POST(json("/api/vehicles", "POST", { name: "LF 10" }));
    expect(created.status).toBe(201);
    expect((await created.json()).name).toBe("LF 10");
  });

  it("POST /api/vehicles: 400 bei ungültigem Body", async () => {
    cookie.token = adminToken;
    expect((await vehiclesRoute.POST(json("/api/vehicles", "POST", { name: "  " }))).status).toBe(400);
    const broken = new NextRequest("http://localhost/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{kein json",
    });
    expect((await vehiclesRoute.POST(broken)).status).toBe(400);
  });

  it("DELETE /api/vehicles/[id]: Nutzer 403 und Fahrzeug bleibt, Admin löscht", async () => {
    const [v] = await testDb.insert(vehicles).values({ name: "Zu löschen" }).returning();

    cookie.token = userToken;
    const req = json(`/api/vehicles/${v.id}`, "DELETE");
    expect((await vehicleRoute.DELETE(req, params(v.id))).status).toBe(403);
    expect(await testDb.select().from(vehicles).where(eq(vehicles.id, v.id))).toHaveLength(1);

    cookie.token = adminToken;
    expect((await vehicleRoute.DELETE(req, params(v.id))).status).toBe(200);
    expect(await testDb.select().from(vehicles).where(eq(vehicles.id, v.id))).toHaveLength(0);
  });

  it("PATCH/DELETE /api/items/[id]: ohne Session 401, als Nutzer 403", async () => {
    cookie.token = null;
    expect(
      (await itemRoute.PATCH(json("/api/items/1", "PATCH", { name: "x" }), params(1))).status
    ).toBe(401);
    cookie.token = userToken;
    expect(
      (await itemRoute.PATCH(json("/api/items/1", "PATCH", { name: "x" }), params(1))).status
    ).toBe(403);
    expect((await itemRoute.DELETE(json("/api/items/1", "DELETE"), params(1))).status).toBe(403);
  });
});
