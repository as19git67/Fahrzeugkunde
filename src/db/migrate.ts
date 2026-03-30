/**
 * Initialisiert die Datenbank (Tabellen anlegen).
 * Aufruf: npx tsx src/db/migrate.ts
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "fahrzeugkunde.db");

// data/ Verzeichnis anlegen
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vehicle_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK(side IN ('left','right','back','top','front')),
  label TEXT NOT NULL,
  image_path TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS compartments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  view_id INTEGER NOT NULL REFERENCES vehicle_views(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  image_path TEXT,
  hotspot_x REAL,
  hotspot_y REAL,
  hotspot_w REAL,
  hotspot_h REAL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  compartment_id INTEGER NOT NULL REFERENCES compartments(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  hotspot_x REAL,
  hotspot_y REAL,
  hotspot_w REAL,
  hotspot_h REAL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_path TEXT,
  silhouette_path TEXT,
  category TEXT,
  difficulty INTEGER DEFAULT 1,
  position_id INTEGER REFERENCES positions(id),
  location_label TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handle TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auth_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS highscores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  handle TEXT NOT NULL,
  score INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('time_attack','speed_run')),
  correct_answers INTEGER NOT NULL,
  total_answers INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  vehicle_id INTEGER REFERENCES vehicles(id),
  created_at TEXT DEFAULT (datetime('now'))
);
`);

console.log("✅ Datenbank initialisiert:", DB_PATH);
sqlite.close();
