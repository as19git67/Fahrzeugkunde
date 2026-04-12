/**
 * Test-Helper: Stellt eine saubere DB-Verbindung für Integration-Tests bereit.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { seedDemoVehicle, type SeedResult } from "@/db/seed-data";
import { describe } from "vitest";

const TEST_DATABASE_URL =
  process.env.POSTGRES_TEST_CONNECTION_STRING ||
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/fahrzeugkunde_test";

let pool: Pool;

/**
 * Wrapper: überspringt describe-Block wenn kein PostgreSQL verfügbar.
 */
export const describeDb = process.env.__SKIP_DB_TESTS === "true"
  ? describe.skip
  : describe;

export function getTestDb() {
  if (!pool) {
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
  }
  return drizzle(pool, { schema });
}

export async function getTestPool() {
  if (!pool) {
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
  }
  return pool;
}

/**
 * Löscht alle Daten in umgekehrter FK-Reihenfolge.
 */
export async function cleanDb() {
  const p = await getTestPool();
  await p.query(`
    DELETE FROM highscores;
    DELETE FROM sessions;
    DELETE FROM auth_codes;
    DELETE FROM users;
    DELETE FROM items;
    DELETE FROM boxes;
    DELETE FROM positions;
    DELETE FROM compartments;
    DELETE FROM vehicle_views;
    DELETE FROM vehicles;
  `);
}

export async function closeDb() {
  if (pool) {
    await pool.end();
  }
}

/**
 * Leert die DB und befüllt sie frisch mit dem Demo-HLF 20 Seed.
 * Nützlich für Integrationstests, die auf einer realistischen Beladung aufbauen.
 */
export async function resetAndSeedDb(): Promise<SeedResult> {
  await cleanDb();
  const p = await getTestPool();
  return seedDemoVehicle(p);
}
