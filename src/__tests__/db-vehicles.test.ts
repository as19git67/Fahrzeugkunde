import { it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, closeDb, describeDb as describe } from "./db-helper";
import {
  vehicles,
  vehicleViews,
  compartments,
  positions,
  items,
} from "@/db/schema";

const db = getTestDb();

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await cleanDb();
  await closeDb();
});

describe("vehicles CRUD", () => {
  it("can insert and read a vehicle", async () => {
    const [v] = await db
      .insert(vehicles)
      .values({ name: "HLF 20", description: "Testfahrzeug" })
      .returning();

    expect(v.id).toBeGreaterThan(0);
    expect(v.name).toBe("HLF 20");
    expect(v.createdAt).toBeTruthy();

    const all = await db.select().from(vehicles);
    expect(all).toHaveLength(1);
  });

  it("can list multiple vehicles", async () => {
    await db.insert(vehicles).values([
      { name: "HLF 20" },
      { name: "TLF 16/25" },
      { name: "DLK 23/12" },
    ]);

    const all = await db.select().from(vehicles);
    expect(all).toHaveLength(3);
  });
});

describe("vehicle views", () => {
  it("can create views for a vehicle", async () => {
    const [v] = await db.insert(vehicles).values({ name: "HLF 20" }).returning();

    const [view] = await db
      .insert(vehicleViews)
      .values({
        vehicleId: v.id,
        side: "left",
        label: "Fahrzeug links",
        sortOrder: 0,
      })
      .returning();

    expect(view.vehicleId).toBe(v.id);
    expect(view.side).toBe("left");
  });

  it("cascades delete to views", async () => {
    const [v] = await db.insert(vehicles).values({ name: "HLF 20" }).returning();
    await db.insert(vehicleViews).values({
      vehicleId: v.id,
      side: "left",
      label: "links",
    });

    await db.delete(vehicles).where(eq(vehicles.id, v.id));

    const remaining = await db.select().from(vehicleViews);
    expect(remaining).toHaveLength(0);
  });
});

describe("full vehicle hierarchy", () => {
  it("can build vehicle → view → compartment → position → item", async () => {
    const [v] = await db.insert(vehicles).values({ name: "HLF 20" }).returning();

    const [view] = await db
      .insert(vehicleViews)
      .values({ vehicleId: v.id, side: "left", label: "links" })
      .returning();

    const [comp] = await db
      .insert(compartments)
      .values({ viewId: view.id, label: "G1" })
      .returning();

    const [pos] = await db
      .insert(positions)
      .values({ compartmentId: comp.id, label: "oben links" })
      .returning();

    const [item] = await db
      .insert(items)
      .values({
        vehicleId: v.id,
        name: "Seilwinde",
        description: "Zum Ziehen schwerer Lasten",
        category: "bergung",
        difficulty: 2,
        positionId: pos.id,
        locationLabel: "G1, oben links",
      })
      .returning();

    expect(item.positionId).toBe(pos.id);
    expect(item.vehicleId).toBe(v.id);

    // Cascading delete: Fahrzeug löschen entfernt alles
    await db.delete(vehicles).where(eq(vehicles.id, v.id));

    const remainingItems = await db.select().from(items);
    const remainingPositions = await db.select().from(positions);
    const remainingComps = await db.select().from(compartments);
    expect(remainingItems).toHaveLength(0);
    expect(remainingPositions).toHaveLength(0);
    expect(remainingComps).toHaveLength(0);
  });

  it("can update item fields", async () => {
    const [v] = await db.insert(vehicles).values({ name: "HLF 20" }).returning();
    const [item] = await db
      .insert(items)
      .values({ vehicleId: v.id, name: "Rettungsschere" })
      .returning();

    const [updated] = await db
      .update(items)
      .set({ description: "Hydraulisch", difficulty: 3 })
      .where(eq(items.id, item.id))
      .returning();

    expect(updated.description).toBe("Hydraulisch");
    expect(updated.difficulty).toBe(3);
    expect(updated.name).toBe("Rettungsschere");
  });
});

describe("compartments with hotspots", () => {
  it("stores hotspot coordinates", async () => {
    const [v] = await db.insert(vehicles).values({ name: "HLF 20" }).returning();
    const [view] = await db
      .insert(vehicleViews)
      .values({ vehicleId: v.id, side: "left", label: "links" })
      .returning();

    const [comp] = await db
      .insert(compartments)
      .values({
        viewId: view.id,
        label: "G1",
        hotspotX: 10.5,
        hotspotY: 20.3,
        hotspotW: 15.0,
        hotspotH: 25.7,
      })
      .returning();

    expect(comp.hotspotX).toBeCloseTo(10.5);
    expect(comp.hotspotY).toBeCloseTo(20.3);
    expect(comp.hotspotW).toBeCloseTo(15.0);
    expect(comp.hotspotH).toBeCloseTo(25.7);
  });
});
