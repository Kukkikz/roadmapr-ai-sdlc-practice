import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { createAccessLink, revokeAccessLink } from "../src/data/links";
import * as schema from "../src/db/schema";
import { members, teams } from "../src/db/schema";
import { generateToken, hashToken } from "../src/lib/link-token";

// Dev helper for manual testing: prints fresh secret links for the seeded "acme" Team. Local
// PGlite only: it refuses to run when DATABASE_URL is set. Run `npm run db:reset` first, and stop
// `npm run dev`, because a file-backed PGlite database allows one process at a time.
if (process.env.DATABASE_URL) {
  console.error("Refusing to mint links: DATABASE_URL is set, so the app uses a hosted Postgres.");
  console.error("Unset it (or remove it from .env.local) to use the local PGlite database.");
  process.exit(1);
}

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const dir = process.env.PGLITE_DATA_DIR || ".data/pglite";
const client = new PGlite(dir);
const db = drizzlePglite(client, { schema });

const [team] = await db.select().from(teams).where(eq(teams.slug, "acme"));
if (!team) throw new Error('No "acme" Team. Run `npm run db:migrate` and `npm run db:seed` first.');
const [owner] = await db
  .select()
  .from(members)
  .where(and(eq(members.teamId, team.id), eq(members.role, "owner")));
if (!owner) throw new Error("The acme Team has no Owner.");

const day = 24 * 60 * 60 * 1000;
async function link(
  kind: "owner" | "member_invite",
  extra: { memberId?: string; expiresAt?: Date } = {},
) {
  const token = generateToken();
  const row = await createAccessLink(db, {
    teamId: team.id,
    kind,
    tokenHash: hashToken(token),
    ...extra,
  });
  return { token, row };
}

const ownerLink = await link("owner", { memberId: owner.id });
const invite = await link("member_invite", { expiresAt: new Date(Date.now() + 7 * day) });
const expired = await link("member_invite", { expiresAt: new Date(Date.now() - day) });
const revoked = await link("member_invite", { expiresAt: new Date(Date.now() + 7 * day) });
await revokeAccessLink(db, revoked.row.id);

console.log(`
Owner link (signs in ${owner.displayName}; stays valid after use):
  ${baseUrl}/login/${ownerLink.token}
Member invite link (7 days, multi-use, asks for a display name):
  ${baseUrl}/join/${invite.token}
Expired invite (should say "Link not valid"):
  ${baseUrl}/join/${expired.token}
Revoked invite (should say "Link not valid"):
  ${baseUrl}/join/${revoked.token}
`);
await client.close();
