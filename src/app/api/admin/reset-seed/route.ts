/**
 * POST /api/admin/reset-seed
 *
 * Stellt sicher, dass das Schema migriert ist, setzt dann die spielrelevanten
 * Tabellen zurück und befüllt sie frisch mit dem HLF-20-Seed. Nur eingeloggte
 * Benutzer dürfen die Aktion auslösen — so kann sie bequem aus dem Creator-UI
 * genutzt werden. Benutzer/Sessions bleiben erhalten.
 */
import { NextResponse } from "next/server";
import { Pool } from "pg";
import path from "node:path";
import fs from "node:fs";
import { seedDemoVehicle } from "@/db/seed-data";
import { SCHEMA_SQL } from "@/db/schema-sql";
import { getSessionUser } from "@/lib/auth";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/fahrzeugkunde";

/**
 * Spiegelt den Quellordner force-overwrite ins Ziel: bestehende Dateien werden
 * ueberschrieben, im Ziel ueberzaehlige Dateien geloescht. Nur fuer kuratierte
 * Seed-Ordner verwenden, niemals fuer User-Upload-Pfade.
 */
function mirrorForce(srcDir: string, destDir: string): number {
  if (!fs.existsSync(srcDir)) return 0;
  fs.mkdirSync(destDir, { recursive: true });
  const srcEntries = new Set(fs.readdirSync(srcDir));
  for (const name of fs.readdirSync(destDir)) {
    if (!srcEntries.has(name)) {
      fs.rmSync(path.join(destDir, name), { recursive: true, force: true });
    }
  }
  let written = 0;
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

/**
 * Aktualisiert die kuratierten Seed-Assets (Item-Icons + Fahrzeugansichten)
 * im Upload-Ziel. Im Docker-Container liegt die Quelle unter /app/bundled-uploads,
 * in der Entwicklung unter public/uploads selbst — in letzterem Fall ist die
 * Operation ein No-Op, weil Quelle und Ziel identisch sind.
 */
function refreshSeedAssets(): number {
  const cwd = process.cwd();
  const bundled = path.join(cwd, "bundled-uploads");
  const target = path.join(cwd, "public", "uploads");
  if (!fs.existsSync(bundled)) return 0;
  if (path.resolve(bundled) === path.resolve(target)) return 0;
  let n = 0;
  for (const rel of [path.join("items", "seed"), "views"]) {
    n += mirrorForce(path.join(bundled, rel), path.join(target, rel));
  }
  return n;
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    // Schema sicherstellen, falls die DB frisch oder veraltet ist
    await pool.query(SCHEMA_SQL);

    // Nur Fahrzeug- und Spiel-Daten löschen. Benutzer/Sessions bleiben erhalten.
    await pool.query(`
      DELETE FROM highscores;
      DELETE FROM items;
      DELETE FROM boxes;
      DELETE FROM positions;
      DELETE FROM compartments;
      DELETE FROM vehicle_views;
      DELETE FROM vehicles;
    `);

    const result = await seedDemoVehicle(pool);

    // Kuratierte Seed-Bilder (items/seed, views) aus dem Image-Snapshot
    // ueberschreiben, damit neu generierte SVGs nach DB-Reset auch auf
    // der Festplatte aktuell sind.
    const refreshed = refreshSeedAssets();

    return NextResponse.json({
      success: true,
      vehicleId: result.vehicleId,
      itemCount: result.itemCount,
      refreshedAssets: refreshed,
    });
  } catch (err) {
    console.error("reset-seed failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
