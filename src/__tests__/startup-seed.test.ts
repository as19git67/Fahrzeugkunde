/**
 * Tests fuer den Startup-Seed in startup.js.
 *
 * 1. Idempotenz: Die Pruefung darf NICHT nach dem Namen "HLF 20" suchen –
 *    nach einer Umbenennung entstand frueher ein zweites HLF 20.
 * 2. Vollstaendigkeit: Der Start legt das KOMPLETTE Demo-Fahrzeug an. Frueher
 *    entstand nur ein leeres "HLF 20", das nicht spielbar war und den
 *    Voll-Seed dauerhaft blockierte.
 * 3. Bundle: Das per esbuild erzeugte dist/seed-data.cjs (fuer das Standalone-
 *    Image) liefert dieselbe Seed-Funktion wie die TypeScript-Quelle.
 */
import { it, expect, beforeEach, afterAll, describe as describeAlways } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { getTestDb, getTestPool, cleanDb, closeDb, describeDb as describe } from "./db-helper";
import { vehicles, items } from "@/db/schema";
import { seedDemoVehicle } from "@/db/seed-data";
import { HLF20_ITEMS } from "@/db/seed-hlf20";

// startup.js ist CommonJS; require() funktioniert dank tsx/vitest-Interop.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { seed, SEED_MIRROR_DIRS, SEED_BUNDLE_PATH } = require("../../startup.js");

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

  it("erwartet das Seed-Bundle unter dist/seed-data.cjs (Dockerfile kopiert genau das)", () => {
    expect(String(SEED_BUNDLE_PATH).replace(/\\/g, "/")).toMatch(/\/dist\/seed-data\.cjs$/);
  });
});

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await cleanDb();
  await closeDb();
});

describe("startup seed", () => {
  it("legt bei leerer DB das komplette HLF 20 mit Beladung an", async () => {
    const pool = await getTestPool();
    const result = await seed(pool, seedDemoVehicle);
    expect(result?.itemCount).toBe(HLF20_ITEMS.length);

    const vs = await db.select().from(vehicles);
    expect(vs).toHaveLength(1);
    expect(vs[0].name).toBe("HLF 20");
    expect(await db.select().from(items)).toHaveLength(HLF20_ITEMS.length);
  });

  it("legt nach Umbenennung kein zweites Fahrzeug an", async () => {
    const pool = await getTestPool();

    // Erster Start: seedet HLF 20
    await seed(pool, seedDemoVehicle);
    let vs = await db.select().from(vehicles);
    expect(vs).toHaveLength(1);

    // Benutzer benennt das Fahrzeug um
    await pool.query("UPDATE vehicles SET name = $1 WHERE id = $2", [
      "HLF 20 Musterstadt",
      vs[0].id,
    ]);

    // Zweiter Start: darf NICHT erneut seeden
    expect(await seed(pool, seedDemoVehicle)).toBeNull();

    vs = await db.select().from(vehicles);
    expect(vs).toHaveLength(1);
    expect(vs[0].name).toBe("HLF 20 Musterstadt");
  });

  it("ist idempotent, wenn das Fahrzeug unveraendert geblieben ist", async () => {
    const pool = await getTestPool();
    await seed(pool, seedDemoVehicle);
    await seed(pool, seedDemoVehicle);
    await seed(pool, seedDemoVehicle);

    const vs = await db.select().from(vehicles);
    expect(vs).toHaveLength(1);
  });

  it("laesst bei einem Fehler mitten im Seed keine halbe Beladung zurueck", async () => {
    const pool = await getTestPool();
    const failing = async (conn: Parameters<typeof seedDemoVehicle>[0]) => {
      await conn.query("INSERT INTO vehicles (name) VALUES ('Halb fertig')");
      throw new Error("Seed kaputt (simuliert)");
    };
    await expect(seed(pool, failing)).rejects.toThrow(/simuliert/);
    expect(await db.select().from(vehicles)).toHaveLength(0);
    // …und der naechste Start seedet ganz normal
    await seed(pool, seedDemoVehicle);
    expect(await db.select().from(items)).toHaveLength(HLF20_ITEMS.length);
  });

  it("das gebuendelte dist/seed-data.cjs seedet identisch zur TypeScript-Quelle", async () => {
    execFileSync("node", ["scripts/bundle-seed.mjs"], { cwd: process.cwd(), stdio: "pipe", timeout: 60_000 });
    const requireFresh = createRequire(import.meta.url);
    delete requireFresh.cache[requireFresh.resolve(SEED_BUNDLE_PATH)];
    const bundled = requireFresh(SEED_BUNDLE_PATH) as { seedDemoVehicle: typeof seedDemoVehicle };
    expect(typeof bundled.seedDemoVehicle).toBe("function");

    const pool = await getTestPool();
    const result = await seed(pool, bundled.seedDemoVehicle);
    expect(result?.itemCount).toBe(HLF20_ITEMS.length);
    expect(await db.select().from(items)).toHaveLength(HLF20_ITEMS.length);
  }, 90_000);
});
