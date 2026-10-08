import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";

// Applies ./drizzle migrations to Neon when DATABASE_URL is set, else to local PGlite.
// Deliberately independent of src/lib/env.ts so CI can migrate without app secrets.
const migrationsFolder = "./drizzle";
const url = process.env.DATABASE_URL;

if (url) {
  await migrateNeon(drizzleNeon(neon(url)), { migrationsFolder });
  console.log("Migrations applied to Postgres (DATABASE_URL).");
} else {
  mkdirSync(".data", { recursive: true });
  const client = new PGlite(".data/pglite");
  await migratePglite(drizzlePglite(client), { migrationsFolder });
  await client.close();
  console.log("Migrations applied to local PGlite (.data/pglite).");
}
