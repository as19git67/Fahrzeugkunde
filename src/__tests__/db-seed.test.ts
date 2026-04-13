import { it, expect, beforeEach, afterAll } from "vitest";
import { getTestDb, cleanDb, closeDb, resetAndSeedDb, describeDb as describe } from "./db-helper";
import { vehicles, items, vehicleViews, compartments, positions, boxes } from "@/db/schema";

const db = getTestDb();

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await cleanDb();
  await closeDb();
});

describe("resetAndSeedDb", () => {
  it("creates an empty HLF 20 demo vehicle", async () => {
    // Vorher: leer
    expect(await db.select().from(vehicles)).toHaveLength(0);

    const result = await resetAndSeedDb();

    // HLF 20 angelegt
    const vs = await db.select().from(vehicles);
    expect(vs).toHaveLength(1);
    expect(vs[0].name).toBe("HLF 20");
    expect(result.vehicleId).toBe(vs[0].id);

    // Seed-Daten sind absichtlich leer
    expect(result.itemCount).toBe(0);
    expect(await db.select().from(items)).toHaveLength(0);
    expect(await db.select().from(vehicleViews)).toHaveLength(0);
    expect(await db.select().from(compartments)).toHaveLength(0);
    expect(await db.select().from(positions)).toHaveLength(0);
    expect(await db.select().from(boxes)).toHaveLength(0);
  });

  it("is idempotent: calling twice wipes and reseeds", async () => {
    await resetAndSeedDb();
    const r2 = await resetAndSeedDb();

    const vs = await db.select().from(vehicles);
    expect(vs).toHaveLength(1);
    expect(vs[0].id).toBe(r2.vehicleId);
  });
});
