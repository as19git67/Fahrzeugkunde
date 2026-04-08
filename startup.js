/**
 * Startup-Skript: Führt beim Container-Start Migration und Seed durch,
 * dann startet den Next.js Server. Alle Operationen sind idempotent.
 */
const { Client } = require("pg");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/fahrzeugkunde";

// --- Uploads-Verzeichnis vorbereiten (Docker-Volume) ---
function setupUploads() {
  const dataAssets = "/data/assets";
  const publicUploads = path.join(__dirname, "public", "uploads");

  // Nur im Container mit /data Volume
  if (fs.existsSync("/data")) {
    fs.mkdirSync(dataAssets, { recursive: true });
    // Symlink nur setzen, wenn noch nicht korrekt vorhanden
    try {
      const target = fs.readlinkSync(publicUploads);
      if (target !== dataAssets) {
        fs.rmSync(publicUploads, { recursive: true, force: true });
        fs.symlinkSync(dataAssets, publicUploads);
      }
    } catch {
      fs.rmSync(publicUploads, { recursive: true, force: true });
      fs.symlinkSync(dataAssets, publicUploads);
    }
    console.log("📁 Uploads: /data/assets → public/uploads");
  }
}

// --- Migration: Tabellen anlegen (IF NOT EXISTS) ---
async function migrate(client) {
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
      location_label TEXT,
      created_at TIMESTAMP DEFAULT now()
    );

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
  console.log("✅ Migration abgeschlossen");
}

// --- Seed: Demo-Fahrzeug HLF 20 (idempotent) ---
async function seed(client) {
  // Prüfen ob bereits Seed-Daten vorhanden
  const existing = await client.query(
    "SELECT id FROM vehicles WHERE name = $1",
    ["HLF 20"]
  );
  if (existing.rows.length > 0) {
    console.log("✅ Seed: HLF 20 bereits vorhanden (id:", existing.rows[0].id, ")");
    return;
  }

  const vehicleRes = await client.query(
    "INSERT INTO vehicles (name, description) VALUES ($1, $2) RETURNING id",
    ["HLF 20", "Hilfeleistungslöschgruppenfahrzeug 20"]
  );
  const vId = vehicleRes.rows[0].id;

  // Ansichten
  const views = [
    { side: "left",  label: "Fahrzeug links",  imagePath: "/uploads/views/hlf_left.svg",  sortOrder: 0 },
    { side: "right", label: "Fahrzeug rechts", imagePath: "/uploads/views/hlf_right.svg", sortOrder: 1 },
    { side: "back",  label: "Fahrzeug hinten", imagePath: "/uploads/views/hlf_back.svg",  sortOrder: 2 },
    { side: "top",   label: "Fahrzeug oben",   imagePath: "/uploads/views/hlf_top.svg",   sortOrder: 3 },
  ];
  for (const v of views) {
    await client.query(
      "INSERT INTO vehicle_views (vehicle_id, side, label, image_path, sort_order) VALUES ($1, $2, $3, $4, $5)",
      [vId, v.side, v.label, v.imagePath, v.sortOrder]
    );
  }

  const leftViewId = (await client.query("SELECT id FROM vehicle_views WHERE vehicle_id = $1 AND side = 'left'", [vId])).rows[0].id;
  const rightViewId = (await client.query("SELECT id FROM vehicle_views WHERE vehicle_id = $1 AND side = 'right'", [vId])).rows[0].id;

  // Fächer
  for (const [viewId, labels] of [[leftViewId, ["G1", "G2", "G3", "G4"]], [rightViewId, ["G5", "G6", "G7", "G8"]]]) {
    for (let i = 0; i < labels.length; i++) {
      await client.query("INSERT INTO compartments (view_id, label, sort_order) VALUES ($1, $2, $3)", [viewId, labels[i], i]);
    }
  }

  async function getCompId(viewId, label) {
    return (await client.query("SELECT id FROM compartments WHERE view_id = $1 AND label = $2", [viewId, label])).rows[0].id;
  }
  async function addPositions(compId, labels) {
    for (let i = 0; i < labels.length; i++) {
      await client.query("INSERT INTO positions (compartment_id, label, sort_order) VALUES ($1, $2, $3)", [compId, labels[i], i]);
    }
  }
  async function getPosId(compId, label) {
    return (await client.query("SELECT id FROM positions WHERE compartment_id = $1 AND label = $2", [compId, label])).rows[0].id;
  }

  const g1Id = await getCompId(leftViewId, "G1");
  const g2Id = await getCompId(leftViewId, "G2");
  const g5Id = await getCompId(rightViewId, "G5");

  await addPositions(g1Id, ["oben links", "oben rechts", "unten links", "orange Kiste"]);
  await addPositions(g2Id, ["vorne", "hinten", "Haken oben"]);
  await addPositions(g5Id, ["oben", "unten links", "unten rechts"]);

  const items = [
    { name: "Seilwinde",        desc: "Zum Ziehen schwerer Lasten",      cat: "bergung",    diff: 2, pos: [g1Id, "orange Kiste"], loc: "G1, orange Kiste" },
    { name: "Schutzmulde",      desc: "Auffangwanne für Gefahrenstoffe", cat: "gefahrgut",  diff: 2, pos: [g1Id, "oben links"],   loc: "G1, oben links" },
    { name: "Rettungsschere",   desc: "Hydraulisches Schneidwerkzeug",   cat: "bergung",    diff: 1, pos: [g2Id, "vorne"],         loc: "G2, vorne" },
    { name: "Rettungszylinder", desc: "Hydraulischer Spreizer",          cat: "bergung",    diff: 2, pos: [g2Id, "vorne"],         loc: "G2, vorne" },
    { name: "Atemschutzgerät",  desc: "Pressluftatemschutz PA",          cat: "atemschutz", diff: 1, pos: [g5Id, "oben"],          loc: "G5, oben" },
    { name: "Handlampe",        desc: "Tragbare LED-Handlampe",          cat: "beleuchtung",diff: 1, pos: [g5Id, "unten links"],   loc: "G5, unten links" },
    { name: "Mehrzweckzug",     desc: "Handseilzug für Bergungen",       cat: "bergung",    diff: 3, pos: [g1Id, "oben links"],   loc: "G1, oben links" },
    { name: "Trennschleifer",   desc: "Elektrisches Schneidwerkzeug",    cat: "werkzeug",   diff: 2, pos: [g2Id, "vorne"],         loc: "G2, vorne" },
    { name: "Tempest Lüfter",   desc: "Hochleistungs-Belüftungsgerät",  cat: "belüftung",  diff: 2, pos: [g5Id, "unten links"],   loc: "G5, unten links" },
    { name: "Sanitätskoffer",   desc: "Erste-Hilfe Ausrüstung",         cat: "sanitaet",   diff: 1, pos: [g5Id, "oben"],          loc: "G5, oben" },
  ];

  for (const item of items) {
    const posId = await getPosId(item.pos[0], item.pos[1]);
    await client.query(
      "INSERT INTO items (vehicle_id, name, description, category, difficulty, position_id, location_label) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [vId, item.name, item.desc, item.cat, item.diff, posId, item.loc]
    );
  }

  console.log(`✅ Seed: HLF 20 mit ${items.length} Gegenständen angelegt (id: ${vId})`);
}

// --- Main ---
async function main() {
  setupUploads();

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await migrate(client);
    await seed(client);
  } finally {
    await client.end();
  }

  // Next.js Server starten
  console.log("🚀 Server wird gestartet...");
  require("./server.js");
}

main().catch((err) => {
  console.error("❌ Startup fehlgeschlagen:", err);
  process.exit(1);
});
