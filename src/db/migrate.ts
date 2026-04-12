/**
 * Initialisiert die Datenbank (Tabellen anlegen).
 * Aufruf: npx tsx src/db/migrate.ts
 */
import pg from "pg";
import { SCHEMA_SQL } from "./schema-sql";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/fahrzeugkunde";

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
await client.query(SCHEMA_SQL);

console.log("✅ Datenbank initialisiert:", DATABASE_URL.replace(/\/\/.*@/, "//<credentials>@"));
await client.end();
