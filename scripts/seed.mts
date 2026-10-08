import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { seed } from "../src/db/seed";

// Seeds Neon when DATABASE_URL is set, else local PGlite. Run `npm run db:migrate` first.
// Deliberately independent of src/lib/env.ts, like migrate.mts.
const url = process.env.DATABASE_URL;

if (url) {
  await seed(drizzleNeon(neon(url)));
  console.log("Seeded Postgres (DATABASE_URL).");
} else {
  mkdirSync(".data", { recursive: true });
  const client = new PGlite(".data/pglite");
  await seed(drizzlePglite(client));
  await client.close();
  console.log("Seeded local PGlite (.data/pglite).");
}
