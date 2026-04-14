/**
 * Zentrale DDL-Anweisungen zum Anlegen bzw. Nachziehen des DB-Schemas.
 * Wird von `src/db/migrate.ts` (CLI) und von der Reset-Seed-Route genutzt, damit
 * die App sich nach einem frischen Postgres-Setup selbst initialisieren kann.
 */
export const SCHEMA_SQL = `
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
  article TEXT,
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

-- Nachträgliche Migration für bestehende Datenbanken
ALTER TABLE items ADD COLUMN IF NOT EXISTS box_id INTEGER REFERENCES boxes(id);
ALTER TABLE items ADD COLUMN IF NOT EXISTS article TEXT;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  verified BOOLEAN DEFAULT false,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT now()
);

-- Nachträgliche Migration für bestehende Datenbanken: role-Spalte ergänzen.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

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
`;
