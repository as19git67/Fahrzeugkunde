/**
 * Seed-Daten: Demo-Fahrzeug HLF 20 mit kompletter Beladung.
 * Aufruf: npm run db:seed   (= npx tsx src/db/seed.ts)
 *
 * Kein Top-Level-await: tsx behandelt die Datei ohne "type": "module" als
 * CommonJS, und dort ist Top-Level-await nicht erlaubt.
 */
import pg from "pg";
import { seedDemoVehicle } from "./seed-data";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/fahrzeugkunde";

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    // Idempotenz-Check: nicht nach Name filtern, sonst entsteht ein Duplikat,
    // wenn das Seed-Fahrzeug inzwischen umbenannt wurde. Sobald ueberhaupt ein
    // Fahrzeug existiert, ist der Seed bereits gelaufen (oder der Benutzer hat
    // manuell Fahrzeuge angelegt) und wir lassen die DB unveraendert.
    const existing = await client.query("SELECT id, name FROM vehicles LIMIT 1");
    if (existing.rows.length > 0) {
      console.log(
        "Fahrzeug bereits vorhanden (id:",
        existing.rows[0].id,
        "name:",
        existing.rows[0].name,
        "), Seed wird uebersprungen"
      );
      return;
    }

    // Alles oder nichts: bei einem Fehler mittendrin bleibt kein halbes
    // Fahrzeug zurück, das den nächsten Seed-Lauf blockieren würde.
    await client.query("BEGIN");
    let result;
    try {
      result = await seedDemoVehicle(client);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    }
    console.log(`✅ Seed abgeschlossen: HLF 20 mit ${result.itemCount} Gegenständen angelegt (id: ${result.vehicleId})`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌ Seed fehlgeschlagen:", err);
  process.exit(1);
});
