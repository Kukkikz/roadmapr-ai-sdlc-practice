import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createAccessLink, createMember } from "@/data";
import { accessLinks, members, teams } from "@/db/schema";
import {
  createInviteLink,
  INVITE_LIFETIME_MS,
  listInviteLinks,
  revokeInviteLink,
} from "@/lib/invite-links";
import { generateToken, hashToken } from "@/lib/link-token";
import { previewLink, redeemLink } from "@/lib/redeem";
import { createTestDb } from "./helpers/db";
import { removeMemberUnguarded } from "./helpers/members";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;
const NOW = new Date("2026-03-01T12:00:00Z");
const ip = () => `192.0.2.${++counter % 250}`;
const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

async function newTeam() {
  const n = ++counter;
  const id = `team-${n}`;
  await ctx.db.insert(teams).values({ id, name: `Team ${n}`, slug: `team-${n}` });
  return id;
}

describe("createInviteLink (US-3.3)", () => {
  it("makes a Member invite link that expires in 7 days and stores only its hash", async () => {
    const team = await newTeam();
    const made = await createInviteLink(ctx.db, team, NOW);

    expect(made.expiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY);
    expect(INVITE_LIFETIME_MS).toBe(7 * DAY);
    const [row] = await ctx.db.select().from(accessLinks).where(eq(accessLinks.id, made.id));
    expect(row).toMatchObject({
      teamId: team,
      kind: "member_invite",
      memberId: null,
      boardId: null,
      revokedAt: null,
    });
    expect(row.tokenHash).toBe(hashToken(made.token));
    expect(row.tokenHash).not.toBe(made.token);
    expect(row.expiresAt?.getTime()).toBe(made.expiresAt.getTime());
  });

  it("makes a link that is multi-use: each redeem is a new Member of that Team", async () => {
    const team = await newTeam();
    const made = await createInviteLink(ctx.db, team, NOW);
    expect(await previewLink(ctx.db, "member_invite", made.token, NOW)).toMatchObject({
      ok: true,
    });
    for (const name of ["One", "Two", "Three"]) {
      expect(
        await redeemLink(ctx.db, ip(), "member_invite", made.token, { displayName: name }, NOW),
      ).toMatchObject({ ok: true });
    }
    const joined = await ctx.db.select().from(members).where(eq(members.teamId, team));
    expect(joined.map((m) => m.role)).toEqual(["member", "member", "member"]);
  });

  it("never issues the same token twice", async () => {
    const team = await newTeam();
    const a = await createInviteLink(ctx.db, team, NOW);
    const b = await createInviteLink(ctx.db, team, NOW);
    expect(a.token).not.toBe(b.token);
    expect(a.id).not.toBe(b.id);
  });

  it("stops working after 7 days", async () => {
    const team = await newTeam();
    const made = await createInviteLink(ctx.db, team, NOW);
    expect(await previewLink(ctx.db, "member_invite", made.token, made.expiresAt)).toEqual({
      ok: false,
    });
  });
});

describe("listInviteLinks", () => {
  it("lists only this Team's invite links, newest first, with their status", async () => {
    const team = await newTeam();
    const other = await newTeam();
    const old = await createInviteLink(ctx.db, team, new Date(NOW.getTime() - 10 * DAY));
    const revoked = await createInviteLink(ctx.db, team, new Date(NOW.getTime() - 2 * DAY));
    const fresh = await createInviteLink(ctx.db, team, NOW);
    await revokeInviteLink(ctx.db, team, revoked.id, NOW);
    await createInviteLink(ctx.db, other, NOW);

    const list = await listInviteLinks(ctx.db, team, NOW);
    expect(list.map((link) => [link.id, link.status])).toEqual([
      [fresh.id, "active"],
      [revoked.id, "revoked"],
      [old.id, "expired"],
    ]);
  });

  it("does not list Owner links, and never exposes a token or hash", async () => {
    const team = await newTeam();
    const owner = await createMember(ctx.db, { teamId: team, displayName: "Ada", role: "owner" });
    await createAccessLink(ctx.db, {
      teamId: team,
      kind: "owner",
      tokenHash: hashToken(generateToken()),
      memberId: owner.id,
    });
    expect(await listInviteLinks(ctx.db, team, NOW)).toEqual([]);

    await createInviteLink(ctx.db, team, NOW);
    const [row] = await listInviteLinks(ctx.db, team, NOW);
    expect(Object.keys(row).sort()).toEqual(["createdAt", "expiresAt", "id", "status"]);
  });

  it("is empty for a Team with no invite links", async () => {
    expect(await listInviteLinks(ctx.db, await newTeam(), NOW)).toEqual([]);
  });
});

describe("revokeInviteLink (US-3.3)", () => {
  it("stops the link from working at once", async () => {
    const team = await newTeam();
    const made = await createInviteLink(ctx.db, team, NOW);
    expect(await revokeInviteLink(ctx.db, team, made.id, NOW)).toBe(true);
    expect(await previewLink(ctx.db, "member_invite", made.token, NOW)).toEqual({ ok: false });
    expect(
      await redeemLink(ctx.db, ip(), "member_invite", made.token, { displayName: "Late" }, NOW),
    ).toEqual({ ok: false, error: "invalid" });
  });

  it("keeps Members who already joined (removal is a separate act, US-3.4)", async () => {
    const team = await newTeam();
    const made = await createInviteLink(ctx.db, team, NOW);
    const joined = await redeemLink(
      ctx.db,
      ip(),
      "member_invite",
      made.token,
      { displayName: "Bo" },
      NOW,
    );
    expect(joined).toMatchObject({ ok: true });
    await revokeInviteLink(ctx.db, team, made.id, NOW);
    const [bo] = await ctx.db.select().from(members).where(eq(members.teamId, team));
    expect(bo).toMatchObject({ displayName: "Bo", removedAt: null });
  });

  it("only revokes the named link, not the Team's others", async () => {
    const team = await newTeam();
    const a = await createInviteLink(ctx.db, team, NOW);
    const b = await createInviteLink(ctx.db, team, NOW);
    await revokeInviteLink(ctx.db, team, a.id, NOW);
    expect(await previewLink(ctx.db, "member_invite", b.token, NOW)).toMatchObject({ ok: true });
  });

  it("refuses another Team's link and leaves it working", async () => {
    const mine = await newTeam();
    const theirs = await newTeam();
    const victim = await createInviteLink(ctx.db, theirs, NOW);
    expect(await revokeInviteLink(ctx.db, mine, victim.id, NOW)).toBe(false);
    expect(await previewLink(ctx.db, "member_invite", victim.token, NOW)).toMatchObject({
      ok: true,
    });
    const [row] = await ctx.db.select().from(accessLinks).where(eq(accessLinks.id, victim.id));
    expect(row.revokedAt).toBeNull();
  });

  it("refuses an Owner link, even of the same Team", async () => {
    const team = await newTeam();
    const owner = await createMember(ctx.db, { teamId: team, displayName: "Ada", role: "owner" });
    const token = generateToken();
    const ownerLink = await createAccessLink(ctx.db, {
      teamId: team,
      kind: "owner",
      tokenHash: hashToken(token),
      memberId: owner.id,
    });
    expect(await revokeInviteLink(ctx.db, team, ownerLink.id, NOW)).toBe(false);
    expect(await previewLink(ctx.db, "owner", token, NOW)).toMatchObject({ ok: true });
    await removeMemberUnguarded(ctx.db, owner.id, NOW);
  });

  it("refuses a made-up id", async () => {
    expect(await revokeInviteLink(ctx.db, await newTeam(), "no-such-link", NOW)).toBe(false);
  });

  it("does nothing, successfully, for a link that is already revoked or expired", async () => {
    const team = await newTeam();
    const made = await createInviteLink(ctx.db, team, NOW);
    const first = new Date(NOW.getTime() + 1000);
    await revokeInviteLink(ctx.db, team, made.id, first);
    expect(await revokeInviteLink(ctx.db, team, made.id, new Date(NOW.getTime() + 5000))).toBe(
      true,
    );
    const [row] = await ctx.db.select().from(accessLinks).where(eq(accessLinks.id, made.id));
    expect(row.revokedAt?.getTime()).toBe(first.getTime());

    const lapsed = await createInviteLink(ctx.db, team, new Date(NOW.getTime() - 9 * DAY));
    expect(await revokeInviteLink(ctx.db, team, lapsed.id, NOW)).toBe(true);
    const [lapsedRow] = await ctx.db
      .select()
      .from(accessLinks)
      .where(eq(accessLinks.id, lapsed.id));
    expect(lapsedRow.revokedAt).toBeNull();
  });
});
