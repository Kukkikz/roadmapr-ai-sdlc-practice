import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

export { schema };

const LOCAL_DATA_DIR = ".data/pglite";

export function createNeonDb(url: string) {
  return drizzleNeon(neon(url), { schema });
}

/** In-memory when `dataDir` is omitted; file-backed when given. */
export function createPgliteDb(dataDir?: string) {
  if (dataDir) mkdirSync(dirname(dataDir), { recursive: true });
  return drizzlePglite(new PGlite(dataDir), { schema });
}

export type AppDb = ReturnType<typeof createNeonDb> | ReturnType<typeof createPgliteDb>;

let cached: AppDb | undefined;

/** Neon when DATABASE_URL is set, otherwise file-backed PGlite. */
export function getDb(): AppDb {
  if (!cached) {
    const { DATABASE_URL } = getEnv();
    cached = DATABASE_URL ? createNeonDb(DATABASE_URL) : createPgliteDb(LOCAL_DATA_DIR);
  }
  return cached;
}
