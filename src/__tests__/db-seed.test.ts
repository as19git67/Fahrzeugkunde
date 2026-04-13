import { it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
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
  it("loads the demo HLF 20/16 with the full hierarchy", async () => {
    // Vorher: leer
    expect(await db.select().from(vehicles)).toHaveLength(0);

    const result = await resetAndSeedDb();

    // HLF 20 angelegt
    const vs = await db.select().from(vehicles);
    expect(vs).toHaveLength(1);
    expect(vs[0].name).toBe("HLF 20");
    expect(result.vehicleId).toBe(vs[0].id);

    // Alle 4 Ansichten
    const views = await db.select().from(vehicleViews);
    expect(views).toHaveLength(4);
    expect(views.map((v) => v.side).sort()).toEqual(["back", "left", "right", "top"]);

    // Compartments inkl. leerer Türen
    const comps = await db.select().from(compartments);
    const compLabels = comps.map((c) => c.label);
    expect(compLabels).toContain("Fahrertüre");
    expect(compLabels).toContain("Türe Mannschaft links");
    expect(compLabels).toContain("Beifahrertüre");
    expect(compLabels).toContain("Türe Mannschaft rechts");
    expect(compLabels).toContain("G1");
    expect(compLabels).toContain("G3");
    expect(compLabels).toContain("G5");
    expect(compLabels).toContain("G2");
    expect(compLabels).toContain("G4");
    expect(compLabels).toContain("G6");
    expect(compLabels).toContain("Heck");
    expect(compLabels).toContain("Mannschaftsraum");
    expect(compLabels).toContain("Dach");

    // Türen sind leer (keine Positionen und keine Items)
    const tuerIds = comps
      .filter((c) => /Türe|türe/.test(c.label))
      .map((c) => c.id);
    const allPositions = await db.select().from(positions);
    for (const pos of allPositions) {
      expect(tuerIds).not.toContain(pos.compartmentId);
    }

    // Box-Ebene ist modelliert — mindestens die orange Kiste für Seilwinde etc.
    const bs = await db.select().from(boxes);
    expect(bs.length).toBeGreaterThanOrEqual(1);
    const orangeBox = bs.find((b) => b.label === "orange Kiste");
    expect(orangeBox).toBeDefined();

    // Seilwinde referenziert die orange Kiste
    const [seilwinde] = await db.select().from(items).where(eq(items.name, "Seilwinde"));
    expect(seilwinde.boxId).toBe(orangeBox!.id);
    expect(seilwinde.positionId).not.toBeNull();
    expect(seilwinde.article).toBe("die");

    // Beladung umfasst die erwarteten ~100 Gegenstände
    const its = await db.select().from(items);
    expect(its.length).toBe(result.itemCount);
    expect(its.length).toBeGreaterThanOrEqual(100);

    // Jeder Gegenstand hat einen Artikel (der/die/das)
    for (const it of its) {
      expect(["der", "die", "das"]).toContain(it.article);
    }
  });

  it("is idempotent: calling twice wipes and reseeds", async () => {
    await resetAndSeedDb();
    const r2 = await resetAndSeedDb();

    const vs = await db.select().from(vehicles);
    expect(vs).toHaveLength(1);
    expect(vs[0].id).toBe(r2.vehicleId);
    const its = await db.select().from(items);
    expect(its).toHaveLength(r2.itemCount);
  });
});
