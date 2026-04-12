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
import { seedDemoVehicle } from "@/db/seed-data";
import { SCHEMA_SQL } from "@/db/schema-sql";
import { getSessionUser } from "@/lib/auth";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/fahrzeugkunde";

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
    return NextResponse.json({
      success: true,
      vehicleId: result.vehicleId,
      itemCount: result.itemCount,
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
