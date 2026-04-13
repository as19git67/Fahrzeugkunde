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

// Kopiert rekursiv nur Dateien, die im Ziel noch nicht existieren.
// So bleiben User-Uploads im Volume unverändert, fehlende Seed-Assets
// werden aus dem Image aber wieder aufgefüllt.
function copyMissing(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return 0;
  fs.mkdirSync(destDir, { recursive: true });
  let added = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      added += copyMissing(src, dest);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        added++;
      }
    }
  }
  return added;
}

// Spiegelt einen Ordner force-overwrite ins Ziel: vorhandene Dateien werden
// ueberschrieben, Dateien im Ziel die in der Quelle nicht mehr existieren
// werden geloescht. Wird nur fuer kuratierte Seed-Ordner verwendet
// (items/seed, views), niemals fuer User-Upload-Pfade.
function mirrorForce(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return 0;
  fs.mkdirSync(destDir, { recursive: true });
  const srcEntries = new Set(fs.readdirSync(srcDir));
  let written = 0;
  // 1. Im Ziel ueberzaehlige Dateien entfernen
  if (fs.existsSync(destDir)) {
    for (const name of fs.readdirSync(destDir)) {
      if (!srcEntries.has(name)) {
        fs.rmSync(path.join(destDir, name), { recursive: true, force: true });
      }
    }
  }
  // 2. Quelle force-overwrite ins Ziel kopieren
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      written += mirrorForce(src, dest);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      fs.copyFileSync(src, dest);
      written++;
    }
  }
  return written;
}

// --- Uploads-Verzeichnis vorbereiten (Docker-Volume) ---
function setupUploads() {
  const dataAssets = "/data/assets";
  const publicUploads = path.join(__dirname, "public", "uploads");
  const bundledUploads = path.join(__dirname, "bundled-uploads");

  // Nur im Container mit /data Volume
  if (fs.existsSync("/data")) {
    fs.mkdirSync(dataAssets, { recursive: true });

    // Fehlende Seed-Assets (aus dem gebakten Image-Snapshot) ins persistente
    // Volume spiegeln. Ohne diesen Schritt liefert /_next/image?url=/uploads/...
    // nach dem ersten Deploy 404, weil der Symlink das public/uploads/-Verzeichnis
    // aus dem Image überdeckt.
    if (fs.existsSync(bundledUploads)) {
      const added = copyMissing(bundledUploads, dataAssets);
      if (added > 0) console.log(`📦 ${added} Seed-Asset(s) ins Volume kopiert`);

      // Kuratierte Seed-Ordner immer force-overwrite, damit neu generierte
      // Item-Icons und Fahrzeugansichten nach Re-Deploy wirksam werden.
      // User-Uploads liegen in anderen Pfaden (z.B. items/ ohne "seed/")
      // und bleiben unberührt.
      const forceDirs = [
        path.join("items", "seed"),
        path.join("views"),
      ];
      let refreshed = 0;
      for (const rel of forceDirs) {
        refreshed += mirrorForce(
          path.join(bundledUploads, rel),
          path.join(dataAssets, rel)
        );
      }
      if (refreshed > 0) console.log(`♻️  ${refreshed} kuratierte Seed-Asset(s) aktualisiert`);
    }

    // Prüfen, ob public/uploads bereits ein Symlink auf dataAssets ist
    let alreadyLinked = false;
    try {
      alreadyLinked = fs.readlinkSync(publicUploads) === dataAssets;
    } catch {
      // kein Symlink
    }

    if (!alreadyLinked) {
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

// --- Seed: Demo-Fahrzeug HLF 20 (idempotent, aktuell ohne Beladung) ---
async function seed(client) {
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

  console.log(`✅ Seed: HLF 20 angelegt (id: ${vId}, ohne Beladung)`);
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
