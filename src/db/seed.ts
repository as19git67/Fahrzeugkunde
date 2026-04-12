/**
 * Seed-Daten: Demo-Fahrzeug HLF 20 mit Beispiel-Beladung.
 * Aufruf: npx tsx src/db/seed.ts
 */
import pg from "pg";
import { seedDemoVehicle } from "./seed-data";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/fahrzeugkunde";

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

const existing = await client.query("SELECT id FROM vehicles WHERE name = 'HLF 20'");
if (existing.rows.length > 0) {
  console.log("Fahrzeug HLF 20 bereits vorhanden (id:", existing.rows[0].id, ")");
  await client.end();
  process.exit(0);
}

const result = await seedDemoVehicle(client);
console.log(`✅ Seed abgeschlossen: HLF 20 mit ${result.itemCount} Gegenständen angelegt (id: ${result.vehicleId})`);
await client.end();
