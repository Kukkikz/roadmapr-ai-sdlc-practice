import { mkdirSync, rmSync } from "node:fs";
import { relative, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/db/schema";
import { seed } from "../src/db/seed";

// Deletes the LOCAL PGlite database, migrates it and seeds it. It only ever touches a folder
// inside .data/, and it refuses to run when DATABASE_URL points at a real Postgres (Neon).
// Deliberately independent of src/lib/env.ts, like migrate.mts and seed.mts.
if (process.env.DATABASE_URL) {
  console.error("Refusing to reset: DATABASE_URL is set, so the app uses a hosted Postgres.");
  console.error("Unset it (or remove it from .env.local) to reset the local PGlite database.");
  process.exit(1);
}

const dir = process.env.PGLITE_DATA_DIR || ".data/pglite";
const inside = relative(resolve(".data"), resolve(dir));
if (inside === "" || inside.startsWith("..") || resolve(inside) === inside) {
  console.error(`Refusing to reset "${dir}": it must be a folder inside .data/.`);
  process.exit(1);
}

rmSync(dir, { recursive: true, force: true });
mkdirSync(".data", { recursive: true });
const client = new PGlite(dir);
const db = drizzle(client, { schema });
await migrate(db, { migrationsFolder: "./drizzle" });
await seed(db);
await client.close();
console.log(`Reset local PGlite (${dir}): migrated and seeded.`);
