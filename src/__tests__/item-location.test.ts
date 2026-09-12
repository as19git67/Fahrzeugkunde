/**
 * Tests für die Ortsvalidierung von Gegenständen: Position/Kiste müssen zum
 * Fahrzeug gehören; PATCH /api/items/[id] darf ein Item nicht in ein fremdes
 * Fahrzeug hängen.
 */
import { it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, closeDb, describeDb as describe } from "./db-helper";
import { users, vehicles, vehicleViews, compartments, positions, boxes, items } from "@/db/schema";

process.env.DATABASE_URL =
  process.env.POSTGRES_TEST_CONNECTION_STRING || process.env.DATABASE_URL;

const cookie = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookie.token ? { name, value: cookie.token } : undefined),
  }),
}));

const testDb = getTestDb();
let lib: typeof import("@/lib/item-location");
let itemRoute: typeof import("@/app/api/items/[id]/route");
let itemsRoute: typeof import("@/app/api/items/route");

interface Struct {
  vehicleId: number;
  positionId: number;
  otherPositionId: number;
  boxId: number;
}
let a: Struct;
let b: Struct;

async function buildVehicle(name: string): Promise<Struct> {
  const [v] = await testDb.insert(vehicles).values({ name }).returning();
  const [view] = await testDb
    .insert(vehicleViews)
    .values({ vehicleId: v.id, side: "left", label: "links" })
    .returning();
  const [comp] = await testDb.insert(compartments).values({ viewId: view.id, label: "G1" }).returning();
  const [p1] = await testDb.insert(positions).values({ compartmentId: comp.id, label: "oben" }).returning();
  const [p2] = await testDb.insert(positions).values({ compartmentId: comp.id, label: "unten" }).returning();
  const [box] = await testDb.insert(boxes).values({ positionId: p1.id, label: "Kiste" }).returning();
  return { vehicleId: v.id, positionId: p1.id, otherPositionId: p2.id, boxId: box.id };
}

const patch = (id: number, body: unknown) =>
  itemRoute.PATCH(
    new NextRequest(`http://localhost/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: String(id) }) }
  );

const post = (body: unknown) =>
  itemsRoute.POST(
    new NextRequest("http://localhost/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );

describe("validateItemLocation + Items-Routen", () => {
  beforeAll(async () => {
    lib = await import("@/lib/item-location");
    itemRoute = await import("@/app/api/items/[id]/route");
    itemsRoute = await import("@/app/api/items/route");
    const auth = await import("@/lib/auth");
    await cleanDb();
    a = await buildVehicle("A");
    b = await buildVehicle("B");
    const [admin] = await testDb
      .insert(users)
      .values({ handle: "Admin", email: "admin@test.de", role: "admin" })
      .returning();
    cookie.token = await auth.createSession(admin.id);
  });

  afterAll(async () => {
    cookie.token = null;
    await cleanDb();
    await closeDb();
  });

  it("akzeptiert Position und Kiste des eigenen Fahrzeugs", async () => {
    expect(await lib.validateItemLocation(a.vehicleId, a.positionId, null)).toEqual({
      ok: true,
      location: { positionId: a.positionId, boxId: null },
    });
    // Kiste ohne Position: Position wird aus der Kiste übernommen
    expect(await lib.validateItemLocation(a.vehicleId, null, a.boxId)).toEqual({
      ok: true,
      location: { positionId: a.positionId, boxId: a.boxId },
    });
    expect(await lib.validateItemLocation(a.vehicleId, null, null)).toEqual({
      ok: true,
      location: { positionId: null, boxId: null },
    });
  });

  it("lehnt Orte fremder Fahrzeuge und inkonsistente Kombinationen ab", async () => {
    const foreignPos = await lib.validateItemLocation(a.vehicleId, b.positionId, null);
    expect(foreignPos).toMatchObject({ ok: false, error: expect.stringMatching(/nicht zu diesem Fahrzeug/) });
    const foreignBox = await lib.validateItemLocation(a.vehicleId, null, b.boxId);
    expect(foreignBox).toMatchObject({ ok: false, error: expect.stringMatching(/nicht zu diesem Fahrzeug/) });
    const mismatch = await lib.validateItemLocation(a.vehicleId, a.otherPositionId, a.boxId);
    expect(mismatch).toMatchObject({ ok: false, error: expect.stringMatching(/nicht zur angegebenen Position/) });
    expect(await lib.validateItemLocation(a.vehicleId, 999999, null)).toMatchObject({ ok: false });
    expect(await lib.validateItemLocation(a.vehicleId, null, 999999)).toMatchObject({ ok: false });
  });

  it("pickItemFields: übernimmt nur bekannte Felder mit korrekten Typen", () => {
    expect(lib.pickItemFields({ name: " Axt ", vehicleId: 99, role: "admin", difficulty: 2 })).toEqual({
      name: "Axt",
      difficulty: 2,
    });
    expect(lib.pickItemFields({ plural: true })).toEqual({ plural: true });
    expect(lib.pickItemFields({ plural: "ja" })).toMatchObject({ error: expect.any(String) });
    expect(lib.pickItemFields({ name: "" })).toMatchObject({ error: expect.any(String) });
    expect(lib.pickItemFields({ difficulty: 7 })).toMatchObject({ error: expect.any(String) });
    expect(lib.pickItemFields({ positionId: "abc" })).toMatchObject({ error: expect.any(String) });
    expect(lib.pickItemFields({ positionId: null, imagePath: "" })).toEqual({
      positionId: null,
      imagePath: null,
    });
  });

  it("POST /api/items: lehnt fremde Position ab, legt sonst an", async () => {
    const bad = await post({ vehicleId: a.vehicleId, name: "Axt", positionId: b.positionId });
    expect(bad.status).toBe(400);
    expect(await testDb.select().from(items)).toHaveLength(0);

    const ok = await post({ vehicleId: a.vehicleId, name: "Axt", boxId: a.boxId });
    expect(ok.status).toBe(201);
    const created = await ok.json();
    expect(created.positionId).toBe(a.positionId);
    expect(created.boxId).toBe(a.boxId);

    expect((await post({ vehicleId: 999999, name: "Axt" })).status).toBe(404);
    expect((await post({ vehicleId: a.vehicleId })).status).toBe(400);
  });

  it("PATCH /api/items/[id]: Item kann nicht in ein fremdes Fahrzeug gehängt werden", async () => {
    const [item] = await testDb
      .insert(items)
      .values({ vehicleId: a.vehicleId, name: "Schlauch", positionId: a.positionId })
      .returning();

    const res = await patch(item.id, { positionId: b.positionId, boxId: null });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/nicht zu diesem Fahrzeug/);
    const [unchanged] = await testDb.select().from(items).where(eq(items.id, item.id));
    expect(unchanged.positionId).toBe(a.positionId);

    // gültiger Wechsel innerhalb des Fahrzeugs
    const ok = await patch(item.id, { positionId: a.otherPositionId, boxId: null, name: "Schlauch C" });
    expect(ok.status).toBe(200);
    const [changed] = await testDb.select().from(items).where(eq(items.id, item.id));
    expect(changed.positionId).toBe(a.otherPositionId);
    expect(changed.name).toBe("Schlauch C");

    // vehicleId lässt sich nicht per PATCH umhängen (wird ignoriert)
    const ignored = await patch(item.id, { vehicleId: b.vehicleId, name: "Schlauch D" });
    expect(ignored.status).toBe(200);
    const [still] = await testDb.select().from(items).where(eq(items.id, item.id));
    expect(still.vehicleId).toBe(a.vehicleId);

    expect((await patch(item.id, {})).status).toBe(400);
    expect((await patch(999999, { name: "x" })).status).toBe(404);
  });
});
