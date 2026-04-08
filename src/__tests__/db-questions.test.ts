import { it, expect, beforeAll, afterAll } from "vitest";
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

let vehicleId: number;

beforeAll(async () => {
  await cleanDb();

  // Seed: Fahrzeug mit genügend Items für Fragengenerierung
  const [v] = await db.insert(vehicles).values({ name: "Testfahrzeug" }).returning();
  vehicleId = v.id;

  const [view] = await db
    .insert(vehicleViews)
    .values({ vehicleId: v.id, side: "left", label: "links" })
    .returning();

  const [comp] = await db
    .insert(compartments)
    .values({ viewId: view.id, label: "G1" })
    .returning();

  const posLabels = ["oben links", "oben rechts", "unten links", "unten rechts"];
  const posIds: number[] = [];
  for (const label of posLabels) {
    const [p] = await db
      .insert(positions)
      .values({ compartmentId: comp.id, label })
      .returning();
    posIds.push(p.id);
  }

  // Mindestens 4 Items mit Bild und Ort
  const seedItems = [
    { name: "Seilwinde",       imagePath: "/img/seilwinde.jpg",      posIdx: 0, loc: "G1, oben links" },
    { name: "Rettungsschere",  imagePath: "/img/rettungsschere.jpg", posIdx: 1, loc: "G1, oben rechts" },
    { name: "Atemschutzgerät", imagePath: "/img/atemschutz.jpg",     posIdx: 2, loc: "G1, unten links" },
    { name: "Handlampe",       imagePath: "/img/handlampe.jpg",      posIdx: 3, loc: "G1, unten rechts" },
    { name: "Mehrzweckzug",    imagePath: "/img/mehrzweckzug.jpg",   posIdx: 0, loc: "G1, oben links" },
  ];

  for (const item of seedItems) {
    await db.insert(items).values({
      vehicleId: v.id,
      name: item.name,
      imagePath: item.imagePath,
      positionId: posIds[item.posIdx],
      locationLabel: item.loc,
      category: "bergung",
      difficulty: 1,
    });
  }
});

afterAll(async () => {
  await cleanDb();
  await closeDb();
});

describe("question data requirements", () => {
  it("has enough items for question generation", async () => {
    const allItems = await db
      .select()
      .from(items)
      .where(eq(items.vehicleId, vehicleId));

    expect(allItems.length).toBeGreaterThanOrEqual(4);
  });

  it("items have images for what_is questions", async () => {
    const withImage = await db
      .select()
      .from(items)
      .where(eq(items.vehicleId, vehicleId));

    const count = withImage.filter((i) => i.imagePath).length;
    expect(count).toBeGreaterThanOrEqual(4);
  });

  it("items have locations for where_is questions", async () => {
    const withLoc = await db
      .select()
      .from(items)
      .where(eq(items.vehicleId, vehicleId));

    const count = withLoc.filter((i) => i.locationLabel).length;
    expect(count).toBeGreaterThanOrEqual(4);
  });

  it("items have positions for where_in_vehicle questions", async () => {
    const withPos = await db
      .select()
      .from(items)
      .where(eq(items.vehicleId, vehicleId));

    const count = withPos.filter((i) => i.positionId).length;
    expect(count).toBeGreaterThan(0);
  });

  it("position → compartment → view hierarchy is intact", async () => {
    const allItems = await db
      .select()
      .from(items)
      .where(eq(items.vehicleId, vehicleId));

    const itemWithPos = allItems.find((i) => i.positionId);
    expect(itemWithPos).toBeTruthy();

    const [pos] = await db
      .select()
      .from(positions)
      .where(eq(positions.id, itemWithPos!.positionId!));
    expect(pos).toBeTruthy();

    const [comp] = await db
      .select()
      .from(compartments)
      .where(eq(compartments.id, pos.compartmentId));
    expect(comp).toBeTruthy();

    const [view] = await db
      .select()
      .from(vehicleViews)
      .where(eq(vehicleViews.id, comp.viewId));
    expect(view).toBeTruthy();
    expect(view.vehicleId).toBe(vehicleId);
  });
});
