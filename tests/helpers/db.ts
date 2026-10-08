import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import * as schema from "@/db/schema";

const MIGRATIONS = { migrationsFolder: "./drizzle" };

/**
 * Fresh migrated database for one test file.
 * In-memory PGlite by default; real Postgres when TEST_DATABASE_URL is set (`npm run test:pg`).
 */
export async function createTestDb() {
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url });
    const db = drizzlePg(pool, { schema });
    await db.execute("drop schema if exists public cascade");
    await db.execute("drop schema if exists drizzle cascade");
    await db.execute("create schema public");
    await migratePg(db, MIGRATIONS);
    return { db, close: () => pool.end(), dialect: "postgres" as const };
  }
  const client = new PGlite();
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, MIGRATIONS);
  return { db, close: () => client.close(), dialect: "pglite" as const };
}
