import { mkdirSync, rmSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { createBoard } from "../src/data/boards";
import { createAccessLink } from "../src/data/links";
import { createIdea, setIdeaStatus } from "../src/data/ideas";
import * as schema from "../src/db/schema";
import { hashToken } from "../src/lib/link-token";
import { E2E_TOKENS } from "../e2e/tokens";
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
// Ideas for vote.spec.ts, one per test so tests never share a vote count.
for (const title of ["Vote A", "Vote B", "Vote C", "Vote D", "Vote E", "Vote F"]) {
  await createIdea(db, { boardId: sandbox.id, title, actorId: "anon:e2e" });
}
// Ideas for comment.spec.ts, one per test.
for (const title of ["Comment A", "Comment B", "Comment C", "Comment D", "Comment E"]) {
  await createIdea(db, { boardId: sandbox.id, title, actorId: "anon:e2e" });
}
const shippedForComments = await createIdea(db, {
  boardId: sandbox.id,
  title: "Comment on shipped",
  actorId: "anon:e2e",
});
await setIdeaStatus(db, shippedForComments.id, "shipped", "member:e2e");
const shipped = await createIdea(db, {
  boardId: sandbox.id,
  title: "Vote on shipped",
  actorId: "anon:e2e",
});
await setIdeaStatus(db, shipped.id, "shipped", "member:e2e");
// Secret links for sign-in.spec.ts: the seeded Owner's link, a live invite, and dead invites.
const [acme] = await db.select().from(schema.teams).where(eq(schema.teams.slug, "acme"));
const [ada] = await db.select().from(schema.members).where(eq(schema.members.teamId, acme.id));
const link = (token: string, extra: Partial<typeof schema.accessLinks.$inferInsert>) =>
  createAccessLink(db, { teamId: acme.id, tokenHash: hashToken(token), ...extra } as never);
await link(E2E_TOKENS.owner, { kind: "owner", memberId: ada.id });
await link(E2E_TOKENS.invite, {
  kind: "member_invite",
  expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
});
const revoked = await link(E2E_TOKENS.revokedInvite, {
  kind: "member_invite",
  expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
});
await client.query("update access_links set revoked_at = now() where id = $1", [revoked.id]);
await link(E2E_TOKENS.expiredInvite, {
  kind: "member_invite",
  expiresAt: new Date("2020-01-01T00:00:00Z"),
});
await client.close();
console.log(`E2E database ready at ${dir}.`);
