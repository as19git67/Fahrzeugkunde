/**
 * Global setup für Vitest: Test-Datenbank erstellen und Migrations ausführen.
 * Wird einmal vor allen Tests ausgeführt.
 * Wenn PostgreSQL nicht erreichbar ist, werden nur Unit-Tests ausgeführt.
 */
import pg from "pg";

const ADMIN_URL =
  process.env.POSTGRES_TEST_CONNECTION_STRING?.replace(/\/[^/]*$/, "/postgres") ||
  process.env.DATABASE_URL?.replace(/\/[^/]*$/, "/postgres") ||
  "postgres://postgres:postgres@localhost:5432/postgres";

const TEST_DB = "fahrzeugkunde_test";

export const TEST_DATABASE_URL =
  process.env.POSTGRES_TEST_CONNECTION_STRING ||
  ADMIN_URL.replace(/\/postgres$/, `/${TEST_DB}`);

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

    // Migrations auf Test-DB ausführen
    const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS vehicle_views (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        side TEXT NOT NULL CHECK(side IN ('left','right','back','top','front')),
        label TEXT NOT NULL,
        image_path TEXT,
        sort_order INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS compartments (
        id SERIAL PRIMARY KEY,
        view_id INTEGER NOT NULL REFERENCES vehicle_views(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        image_path TEXT,
        hotspot_x DOUBLE PRECISION,
        hotspot_y DOUBLE PRECISION,
        hotspot_w DOUBLE PRECISION,
        hotspot_h DOUBLE PRECISION,
        sort_order INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS positions (
        id SERIAL PRIMARY KEY,
        compartment_id INTEGER NOT NULL REFERENCES compartments(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        hotspot_x DOUBLE PRECISION,
        hotspot_y DOUBLE PRECISION,
        hotspot_w DOUBLE PRECISION,
        hotspot_h DOUBLE PRECISION,
        sort_order INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS boxes (
        id SERIAL PRIMARY KEY,
        position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        image_path TEXT,
        hotspot_x DOUBLE PRECISION,
        hotspot_y DOUBLE PRECISION,
        hotspot_w DOUBLE PRECISION,
        hotspot_h DOUBLE PRECISION,
        sort_order INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        image_path TEXT,
        silhouette_path TEXT,
        category TEXT,
        difficulty INTEGER DEFAULT 1,
        position_id INTEGER REFERENCES positions(id),
        box_id INTEGER REFERENCES boxes(id),
        location_label TEXT,
        created_at TIMESTAMP DEFAULT now()
      );
      -- Nachträgliche Migration für bestehende Test-DBs
      ALTER TABLE items ADD COLUMN IF NOT EXISTS box_id INTEGER REFERENCES boxes(id);
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        handle TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS auth_codes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS highscores (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        handle TEXT NOT NULL,
        score INTEGER NOT NULL,
        mode TEXT NOT NULL CHECK(mode IN ('time_attack','speed_run')),
        correct_answers INTEGER NOT NULL,
        total_answers INTEGER NOT NULL,
        duration_seconds INTEGER NOT NULL,
        vehicle_id INTEGER REFERENCES vehicles(id),
        created_at TIMESTAMP DEFAULT now()
      );
    `);
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
