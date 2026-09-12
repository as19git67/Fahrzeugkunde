/**
 * Initialisiert die Datenbank (Tabellen anlegen / Bestandsschema nachziehen).
 * Aufruf: npm run db:migrate   (= npx tsx src/db/migrate.ts)
 *
 * Kein Top-Level-await: tsx behandelt die Datei ohne "type": "module" als
 * CommonJS, und dort ist Top-Level-await nicht erlaubt.
 */
import pg from "pg";
import { SCHEMA_SQL } from "./schema-sql";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/fahrzeugkunde";

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(SCHEMA_SQL);
    console.log("✅ Datenbank initialisiert:", DATABASE_URL.replace(/\/\/.*@/, "//<credentials>@"));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌ Migration fehlgeschlagen:", err);
  process.exit(1);
});
