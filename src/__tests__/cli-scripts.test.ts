/**
 * Die in der README dokumentierten CLI-Skripte `npm run db:migrate` und
 * `npm run db:seed` müssen tatsächlich laufen. Sie waren mit Top-Level-await
 * geschrieben, das tsx ohne "type": "module" (CommonJS) nicht ausführen kann –
 * beide brachen mit einem Transform-Fehler ab.
 *
 * Läuft gegen die Test-DB; ohne eindeutig als Test-DB erkennbare URL wird
 * übersprungen, damit nie eine Produktions-DB geseedet wird.
 */
import { it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { getTestPool, cleanDb, closeDb, describeDb as describe } from "./db-helper";

const TEST_URL =
  process.env.POSTGRES_TEST_CONNECTION_STRING ||
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/fahrzeugkunde_test";
const isTestDb = /_test(\?|$)/.test(TEST_URL);

function runScript(file: string): string {
  return execFileSync("npx", ["tsx", file], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_URL, NODE_ENV: "test" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  });
}

describe("CLI: db:migrate und db:seed", () => {
  beforeAll(async () => {
    await cleanDb();
  });
  afterAll(async () => {
    await cleanDb();
    await closeDb();
  });

  it.skipIf(!isTestDb)("db:migrate läuft gegen eine bestehende DB durch (idempotent)", () => {
    const out = runScript("src/db/migrate.ts");
    expect(out).toMatch(/Datenbank initialisiert/);
    expect(out).not.toMatch(/Top-level await/);
  }, 90_000);

  it.skipIf(!isTestDb)("db:seed legt das Demo-Fahrzeug an und überspringt beim zweiten Lauf", async () => {
    const first = runScript("src/db/seed.ts");
    expect(first).toMatch(/Seed abgeschlossen: HLF 20 mit \d+ Gegenständen/);
    const second = runScript("src/db/seed.ts");
    expect(second).toMatch(/bereits vorhanden/);

    const pool = await getTestPool();
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM vehicles");
    expect(rows[0].n).toBe(1);
  }, 120_000);
});
