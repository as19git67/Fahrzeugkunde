/**
 * Integration-Test der Migration in `src/db/schema.sql` gegen eine
 * Datenbank im Zustand *vor* der Trennung von Gegenstands- und Ortsbild.
 *
 * Anders als die übrigen DB-Tests läuft das hier in einer eigenen
 * Wegwerf-Datenbank: Geprüft wird die DDL selbst, nicht die App darüber.
 */
import { it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { describeDb as describe } from "./db-helper";

const SCHEMA_SQL = fs.readFileSync(
  path.join(process.cwd(), "src", "db", "schema.sql"),
  "utf8"
);

const ADMIN_URL =
  process.env.POSTGRES_TEST_CONNECTION_STRING?.replace(/\/[^/]*$/, "/postgres") ||
  process.env.DATABASE_URL?.replace(/\/[^/]*$/, "/postgres") ||
  "postgres://postgres:postgres@localhost:5432/postgres";

const MIGRATION_DB = "fahrzeugkunde_migration_test";
const MIGRATION_URL = ADMIN_URL.replace(/\/postgres$/, `/${MIGRATION_DB}`);

/** Schema-Stand vor dieser Änderung: ein Bildfeld, dazu die Altfelder. */
const LEGACY_SCHEMA = `
  CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT,
    created_at TIMESTAMP DEFAULT now()
  );
  CREATE TABLE vehicle_views (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    side TEXT NOT NULL, label TEXT NOT NULL, image_path TEXT,
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE compartments (
    id SERIAL PRIMARY KEY,
    view_id INTEGER NOT NULL REFERENCES vehicle_views(id) ON DELETE CASCADE,
    label TEXT NOT NULL, image_path TEXT,
    hotspot_x DOUBLE PRECISION, hotspot_y DOUBLE PRECISION,
    hotspot_w DOUBLE PRECISION, hotspot_h DOUBLE PRECISION,
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE positions (
    id SERIAL PRIMARY KEY,
    compartment_id INTEGER NOT NULL REFERENCES compartments(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    hotspot_x DOUBLE PRECISION, hotspot_y DOUBLE PRECISION,
    hotspot_w DOUBLE PRECISION, hotspot_h DOUBLE PRECISION,
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE boxes (
    id SERIAL PRIMARY KEY,
    position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    label TEXT NOT NULL, image_path TEXT,
    hotspot_x DOUBLE PRECISION, hotspot_y DOUBLE PRECISION,
    hotspot_w DOUBLE PRECISION, hotspot_h DOUBLE PRECISION,
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    name TEXT NOT NULL, article TEXT, description TEXT,
    image_path TEXT, silhouette_path TEXT, category TEXT,
    difficulty INTEGER DEFAULT 1,
    position_id INTEGER REFERENCES positions(id),
    box_id INTEGER REFERENCES boxes(id),
    location_label TEXT,
    created_at TIMESTAMP DEFAULT now()
  );
`;

/** Zwei Gegenstände: einer mit Bild, einer ohne. */
const LEGACY_DATA = `
  INSERT INTO vehicles (name) VALUES ('HLF 20');
  INSERT INTO vehicle_views (vehicle_id, side, label) VALUES (1, 'left', 'Fahrzeug links');
  INSERT INTO compartments (view_id, label) VALUES (1, 'G1');
  INSERT INTO positions (compartment_id, label) VALUES (1, 'unten rechts');
  INSERT INTO boxes (position_id, label) VALUES (1, 'orange Kiste');
  INSERT INTO items (vehicle_id, name, article, description, category, image_path,
                     position_id, box_id, location_label)
    VALUES (1, 'Seilwinde', 'die', 'Alt-Beschreibung', 'bergung',
            '/uploads/items/seilwinde.jpg', 1, 1, 'handgetippter Ort');
  INSERT INTO items (vehicle_id, name, image_path, position_id)
    VALUES (1, 'Gegenstand ohne Bild', NULL, 1);
`;

let client: pg.Client;

async function columnNames(): Promise<string[]> {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'items' ORDER BY column_name`
  );
  return rows.map((r) => r.column_name as string);
}

describe("schema.sql – Migration einer Bestandsdatenbank", () => {
  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${MIGRATION_DB}`);
    await admin.query(`CREATE DATABASE ${MIGRATION_DB}`);
    await admin.end();

    client = new pg.Client({ connectionString: MIGRATION_URL });
    await client.connect();
    await client.query(LEGACY_SCHEMA);
    await client.query(LEGACY_DATA);
    // Die eigentliche Migration
    await client.query(SCHEMA_SQL);
  });

  afterAll(async () => {
    await client.end().catch(() => {});
    const admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${MIGRATION_DB}`);
    await admin.end();
  });

  it("entfernt die ungenutzten Altfelder", async () => {
    const cols = await columnNames();
    expect(cols).not.toContain("category");
    expect(cols).not.toContain("description");
    expect(cols).not.toContain("location_label");
  });

  it("ergänzt location_image_path", async () => {
    expect(await columnNames()).toContain("location_image_path");
  });

  it("übernimmt ein vorhandenes Bild in beide Felder", async () => {
    const { rows } = await client.query(
      "SELECT image_path, location_image_path FROM items WHERE name = 'Seilwinde'"
    );
    expect(rows[0].image_path).toBe("/uploads/items/seilwinde.jpg");
    expect(rows[0].location_image_path).toBe("/uploads/items/seilwinde.jpg");
  });

  it("lässt Gegenstände ohne Bild leer statt sie mit NULL zu füllen", async () => {
    const { rows } = await client.query(
      "SELECT image_path, location_image_path FROM items WHERE name = 'Gegenstand ohne Bild'"
    );
    expect(rows[0].image_path).toBeNull();
    expect(rows[0].location_image_path).toBeNull();
  });

  it("erhält die Verortung, aus der der Ortstext abgeleitet wird", async () => {
    const { rows } = await client.query(
      `SELECT c.label AS compartment, p.label AS position, b.label AS box
         FROM items i
         JOIN boxes b ON b.id = i.box_id
         JOIN positions p ON p.id = b.position_id
         JOIN compartments c ON c.id = p.compartment_id
        WHERE i.name = 'Seilwinde'`
    );
    expect(rows[0]).toMatchObject({
      compartment: "G1",
      position: "unten rechts",
      box: "orange Kiste",
    });
  });

  it("überschreibt ein bewusst entferntes Ortsbild bei erneutem Lauf nicht", async () => {
    // schema.sql läuft bei jedem App-Start. Wer das Ortsbild eines
    // Gegenstands entfernt, darf es beim nächsten Neustart nicht
    // zurückbekommen — die Übernahme gilt nur beim Anlegen der Spalte.
    await client.query(
      "UPDATE items SET location_image_path = NULL WHERE name = 'Seilwinde'"
    );

    await client.query(SCHEMA_SQL);

    const { rows } = await client.query(
      "SELECT image_path, location_image_path FROM items WHERE name = 'Seilwinde'"
    );
    expect(rows[0].location_image_path).toBeNull();
    // Das Gegenstandsbild bleibt davon unberührt
    expect(rows[0].image_path).toBe("/uploads/items/seilwinde.jpg");
  });

  it("ist insgesamt idempotent", async () => {
    await expect(client.query(SCHEMA_SQL)).resolves.toBeDefined();
    const cols = await columnNames();
    expect(cols).toContain("location_image_path");
    expect(cols).not.toContain("category");
  });
});
