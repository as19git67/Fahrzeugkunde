-- Zentrale DDL. Single Source of Truth fuer das DB-Schema.
-- Wird eingebunden von:
--   * src/db/schema-sql.ts (App-Routen + src/db/migrate.ts)
--   * startup.js           (Docker-Containerstart vor Next.js)
--
-- Alle Anweisungen muessen idempotent sein (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS),
-- damit sie sowohl auf frischen als auch auf bestehenden Datenbanken laufen koennen.

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
  position_id INTEGER REFERENCES positions(id) ON DELETE CASCADE,
  box_id INTEGER REFERENCES boxes(id) ON DELETE CASCADE,
  location_label TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Nachtraegliche Migration fuer bestehende Datenbanken
ALTER TABLE items ADD COLUMN IF NOT EXISTS box_id INTEGER REFERENCES boxes(id);
ALTER TABLE items ADD COLUMN IF NOT EXISTS article TEXT;

-- Nachtraegliche Migration fuer bestehende Datenbanken: FK von items.position_id
-- und items.box_id auf ON DELETE CASCADE umstellen, damit das Loeschen eines
-- Fachs, einer Position oder einer Kiste die darin verorteten Gegenstaende
-- mitloescht (statt an einem FK-Constraint zu scheitern). Die Standard-
-- Constraint-Namen von Postgres werden vorausgesetzt; ein DO-Block sorgt fuer
-- Idempotenz: umgestellt wird nur, wenn die delete_rule aktuell nicht CASCADE ist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.referential_constraints
    WHERE constraint_name = 'items_position_id_fkey'
      AND delete_rule <> 'CASCADE'
  ) THEN
    ALTER TABLE items DROP CONSTRAINT items_position_id_fkey;
    ALTER TABLE items ADD CONSTRAINT items_position_id_fkey
      FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.referential_constraints
    WHERE constraint_name = 'items_box_id_fkey'
      AND delete_rule <> 'CASCADE'
  ) THEN
    ALTER TABLE items DROP CONSTRAINT items_box_id_fkey;
    ALTER TABLE items ADD CONSTRAINT items_box_id_fkey
      FOREIGN KEY (box_id) REFERENCES boxes(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  verified BOOLEAN DEFAULT false,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT now()
);

-- Nachtraegliche Migration fuer bestehende Datenbanken: role-Spalte ergaenzen.
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
