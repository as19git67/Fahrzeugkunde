import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/fahrzeugkunde";

// Singleton für Next.js dev (hot reload)
declare global {
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof drizzle> | undefined;
}

function getDb() {
  if (global.__db) return global.__db;

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema });
  global.__db = db;
  return db;
}

export const db = getDb();
export * from "./schema";
