import { mkdirSync, rmSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { createBoard } from "../src/data/boards";
import { createIdea } from "../src/data/ideas";
import * as schema from "../src/db/schema";
import { seed } from "../src/db/seed";

// Builds a fresh, seeded PGlite database for Playwright at PGLITE_DATA_DIR, so end-to-end
// runs never touch the developer's own .data/pglite.
const dir = process.env.PGLITE_DATA_DIR;
if (!dir || dir === ".data/pglite") throw new Error("Set PGLITE_DATA_DIR to a dedicated e2e path.");

rmSync(dir, { recursive: true, force: true });
mkdirSync(".data", { recursive: true });
const client = new PGlite(dir);
const db = drizzle(client, { schema });
await migrate(db, { migrationsFolder: "./drizzle" });
await seed(db);

// A hidden Idea with a known id, so the e2e spec can check that the public gets a 404.
const [product] = await db.select().from(schema.boards).where(eq(schema.boards.slug, "product"));
const hidden = await createIdea(db, {
  boardId: product.id,
  title: "Secret hidden idea",
  actorId: "anon:e2e",
});
await client.query("update ideas set hidden = true, id = 'hidden-idea-e2e' where id = $1", [
  hidden.id,
]);
await createBoard(db, { teamId: product.teamId, name: "Empty board", slug: "empty" });
// A Board for specs that submit Ideas, so they never change what the read-only specs count.
const sandbox = await createBoard(db, {
  teamId: product.teamId,
  name: "Sandbox",
  slug: "sandbox",
});
await createIdea(db, {
  boardId: sandbox.id,
  title: "Offline support",
  actorId: "anon:e2e",
});
await client.close();
console.log(`E2E database ready at ${dir}.`);
