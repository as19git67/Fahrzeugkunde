/**
 * Zentrale DDL-Anweisungen zum Anlegen bzw. Nachziehen des DB-Schemas.
 * Wird von `src/db/migrate.ts` (CLI) und von der Reset-Seed-Route genutzt,
 * damit die App sich nach einem frischen Postgres-Setup selbst initialisieren kann.
 *
 * Single Source of Truth: `src/db/schema.sql`. Diese Datei wird auch vom
 * `startup.js` des Docker-Containers eingelesen — so kann das Schema nicht
 * mehr zwischen App und Startup-Migration auseinanderlaufen.
 */
import fs from "node:fs";
import path from "node:path";

const SCHEMA_SQL_PATH = path.join(process.cwd(), "src", "db", "schema.sql");

export const SCHEMA_SQL = fs.readFileSync(SCHEMA_SQL_PATH, "utf8");
