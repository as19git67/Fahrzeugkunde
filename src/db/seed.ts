/**
 * Seed-Daten: Demo-Fahrzeug HLF 20 (derzeit ohne Beladung).
 * Aufruf: npx tsx src/db/seed.ts
 */
import pg from "pg";
import { seedDemoVehicle } from "./seed-data";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/fahrzeugkunde";

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

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
  await client.end();
  process.exit(0);
}

const result = await seedDemoVehicle(client);
console.log(`✅ Seed abgeschlossen: HLF 20 mit ${result.itemCount} Gegenständen angelegt (id: ${result.vehicleId})`);
await client.end();
