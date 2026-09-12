/**
 * Global setup für Vitest: Test-Datenbank erstellen und Migrations ausführen.
 * Wird einmal vor allen Tests ausgeführt.
 * Wenn PostgreSQL nicht erreichbar ist, werden nur Unit-Tests ausgeführt.
 *
 * Die DDL kommt aus src/db/schema.sql – derselben Datei, die auch startup.js,
 * migrate.ts und der Reset-Seed verwenden. Früher stand hier eine
 * handgeschriebene Kopie, die bereits von schema.sql abgewichen war.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ADMIN_URL =
  process.env.POSTGRES_TEST_CONNECTION_STRING?.replace(/\/[^/]*$/, "/postgres") ||
  process.env.DATABASE_URL?.replace(/\/[^/]*$/, "/postgres") ||
  "postgres://postgres:postgres@localhost:5432/postgres";

const TEST_DB = "fahrzeugkunde_test";

export const TEST_DATABASE_URL =
  process.env.POSTGRES_TEST_CONNECTION_STRING ||
  ADMIN_URL.replace(/\/postgres$/, `/${TEST_DB}`);

const SCHEMA_SQL = fs.readFileSync(
  path.join(process.cwd(), "src", "db", "schema.sql"),
  "utf8"
);

export async function setup() {
  // Prüfen ob PostgreSQL erreichbar ist
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await admin.connect();
  } catch {
    console.log("⚠️  PostgreSQL nicht erreichbar – DB-Tests werden übersprungen");
    process.env.__SKIP_DB_TESTS = "true";
    return;
  }

  try {
    // Test-DB anlegen (falls nicht vorhanden)
    const exists = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [TEST_DB]
    );
    if (exists.rows.length === 0) {
      await admin.query(`CREATE DATABASE ${TEST_DB}`);
    }
    await admin.end();

    // Migration auf der Test-DB – idempotent, auch auf einer wiederverwendeten DB
    const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    await client.query(SCHEMA_SQL);
    await client.end();

    // DATABASE_URL setzen, damit App-Module die Test-DB nutzen
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    console.log("✅ Test-Datenbank bereit:", TEST_DB);
  } catch (err) {
    await admin.end().catch(() => {});
    console.log("⚠️  DB-Setup fehlgeschlagen – DB-Tests werden übersprungen:", err);
    process.env.__SKIP_DB_TESTS = "true";
  }
}

export async function teardown() {
  // Test-DB bleibt bestehen (wird beim nächsten Lauf wiederverwendet)
}
