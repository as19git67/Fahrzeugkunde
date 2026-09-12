/**
 * Regressionstest fuer den Startup-Seed.
 *
 * Hintergrund: Die Idempotenz-Pruefung in startup.js hat frueher nach einem
 * Fahrzeug mit Namen "HLF 20" gesucht. Wenn der Benutzer das Seed-Fahrzeug
 * umbenannt und den Server neu gestartet hat, fand die Pruefung nichts und
 * legte ein zweites HLF 20 an. Dieser Test stellt sicher, dass nach einer
 * Umbenennung kein weiteres Fahrzeug angelegt wird.
 */
import { it, expect, beforeEach, afterAll, describe as describeAlways } from "vitest";
import { getTestDb, getTestPool, cleanDb, closeDb, describeDb as describe } from "./db-helper";
import { vehicles } from "@/db/schema";

// startup.js ist CommonJS; require() funktioniert dank tsx/vitest-Interop.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { seed, SEED_MIRROR_DIRS } = require("../../startup.js");

const db = getTestDb();

describeAlways("startup: Seed-Asset-Spiegelung", () => {
  it("spiegelt nur seed/-Unterordner – nie items/ oder views/ komplett", () => {
    // Regression: views/ wurde früher komplett gespiegelt und hat damit alle im
    // Creator hochgeladenen Fahrzeugansichten bei jedem Neustart gelöscht.
    const dirs = (SEED_MIRROR_DIRS as string[]).map((d) => d.split(/[\\/]/));
    expect(dirs).toEqual(
      expect.arrayContaining([["items", "seed"], ["views", "seed"]])
    );
    for (const segs of dirs) {
      expect(segs.at(-1)).toBe("seed");
    }
  });
});

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await cleanDb();
  await closeDb();
});

describe("startup seed idempotency", () => {
  it("legt bei leerer DB ein HLF 20 an", async () => {
    const pool = await getTestPool();
    await seed(pool);

    const vs = await db.select().from(vehicles);
    expect(vs).toHaveLength(1);
    expect(vs[0].name).toBe("HLF 20");
  });

  it("legt nach Umbenennung kein zweites Fahrzeug an", async () => {
    const pool = await getTestPool();

    // Erster Start: seedet HLF 20
    await seed(pool);
    let vs = await db.select().from(vehicles);
    expect(vs).toHaveLength(1);

    // Benutzer benennt das Fahrzeug um
    await pool.query("UPDATE vehicles SET name = $1 WHERE id = $2", [
      "HLF 20 Musterstadt",
      vs[0].id,
    ]);

    // Zweiter Start: darf NICHT erneut seeden
    await seed(pool);

    vs = await db.select().from(vehicles);
    expect(vs).toHaveLength(1);
    expect(vs[0].name).toBe("HLF 20 Musterstadt");
  });

  it("ist idempotent, wenn das Fahrzeug unveraendert geblieben ist", async () => {
    const pool = await getTestPool();
    await seed(pool);
    await seed(pool);
    await seed(pool);

    const vs = await db.select().from(vehicles);
    expect(vs).toHaveLength(1);
  });
});
