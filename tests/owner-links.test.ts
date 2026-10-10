import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createAccessLink, createMember, findSessionByHash, softRemoveMember } from "@/data";
import { accessLinks, teams } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/link-token";
import { replaceOwnerLink } from "@/lib/owner-links";
import { previewLink, redeemLink } from "@/lib/redeem";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;
const NOW = new Date("2026-03-01T12:00:00Z");
const ip = () => `192.0.2.${++counter % 250}`;

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

async function newTeam() {
  const id = `team-${++counter}`;
  await ctx.db.insert(teams).values({ id, name: id, slug: id });
  return id;
}

/** An Owner with a first Owner link; returns the raw token. */
async function ownerWithLink(teamId: string, name = `Owner ${++counter}`) {
  const owner = await createMember(ctx.db, { teamId, displayName: name, role: "owner" });
  const token = generateToken();
  await createAccessLink(ctx.db, {
    teamId,
    kind: "owner",
    tokenHash: hashToken(token),
    memberId: owner.id,
  });
  return { owner, token };
}

const works = async (token: string) => (await previewLink(ctx.db, "owner", token, NOW)).ok;

describe("replaceOwnerLink (US-3.2)", () => {
  it("makes a new Owner link that works and kills the old one", async () => {
    const team = await newTeam();
    const { owner, token: old } = await ownerWithLink(team);
    expect(await works(old)).toBe(true);

    const fresh = await replaceOwnerLink(ctx.db, team, owner.id, NOW);
    if (!fresh) throw new Error("expected a link");

    expect(await works(fresh.token)).toBe(true);
    expect(await works(old)).toBe(false);
    expect(await redeemLink(ctx.db, ip(), "owner", old, {}, NOW)).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("signs the same Owner in with the new link", async () => {
    const team = await newTeam();
    const { owner } = await ownerWithLink(team);
    const fresh = await replaceOwnerLink(ctx.db, team, owner.id, NOW);
    const result = await redeemLink(ctx.db, ip(), "owner", fresh!.token, {}, NOW);
    if (!result.ok) throw new Error("expected success");
    const live = await findSessionByHash(ctx.db, hashToken(result.sessionToken), NOW);
    expect(live?.member.id).toBe(owner.id);
  });

  it("stores only a hash, as an Owner link tied to that Owner", async () => {
    const team = await newTeam();
    const { owner } = await ownerWithLink(team);
    const fresh = await replaceOwnerLink(ctx.db, team, owner.id, NOW);
    const [row] = await ctx.db.select().from(accessLinks).where(eq(accessLinks.id, fresh!.id));
    expect(row).toMatchObject({
      kind: "owner",
      teamId: team,
      memberId: owner.id,
      boardId: null,
      expiresAt: null,
      revokedAt: null,
    });
    expect(row.tokenHash).toBe(hashToken(fresh!.token));
    expect(row.tokenHash).not.toBe(fresh!.token);
  });

  it("revokes every earlier Owner link of that Owner, and keeps their revoked time", async () => {
    const team = await newTeam();
    const { owner, token: first } = await ownerWithLink(team);
    const second = await replaceOwnerLink(ctx.db, team, owner.id, NOW);
    const later = new Date(NOW.getTime() + 60_000);
    const third = await replaceOwnerLink(ctx.db, team, owner.id, later);

    expect(await works(first)).toBe(false);
    expect(await works(second!.token)).toBe(false);
    expect(await works(third!.token)).toBe(true);
    const [secondRow] = await ctx.db
      .select()
      .from(accessLinks)
      .where(eq(accessLinks.id, second!.id));
    expect(secondRow.revokedAt?.getTime()).toBe(later.getTime());
    const [firstRow] = await ctx.db
      .select()
      .from(accessLinks)
      .where(eq(accessLinks.tokenHash, hashToken(first)));
    expect(firstRow.revokedAt?.getTime()).toBe(NOW.getTime());
  });

  it("leaves another Owner's link of the same Team alone", async () => {
    const team = await newTeam();
    const ada = await ownerWithLink(team, "Ada");
    const bea = await ownerWithLink(team, "Bea");
    await replaceOwnerLink(ctx.db, team, ada.owner.id, NOW);
    expect(await works(ada.token)).toBe(false);
    expect(await works(bea.token)).toBe(true);
  });

  it("leaves another Team's links alone", async () => {
    const mine = await newTeam();
    const theirs = await newTeam();
    const me = await ownerWithLink(mine);
    const other = await ownerWithLink(theirs);
    await replaceOwnerLink(ctx.db, mine, me.owner.id, NOW);
    expect(await works(other.token)).toBe(true);
  });

  it("does not touch Member invite links", async () => {
    const team = await newTeam();
    const { owner } = await ownerWithLink(team);
    const invite = generateToken();
    await createAccessLink(ctx.db, {
      teamId: team,
      kind: "member_invite",
      tokenHash: hashToken(invite),
      expiresAt: new Date(NOW.getTime() + 86_400_000),
    });
    await replaceOwnerLink(ctx.db, team, owner.id, NOW);
    expect((await previewLink(ctx.db, "member_invite", invite, NOW)).ok).toBe(true);
  });

  it("keeps the Owner's sessions signed in", async () => {
    const team = await newTeam();
    const { owner, token } = await ownerWithLink(team);
    const signedIn = await redeemLink(ctx.db, ip(), "owner", token, {}, NOW);
    if (!signedIn.ok) throw new Error("expected success");
    await replaceOwnerLink(ctx.db, team, owner.id, NOW);
    expect(await findSessionByHash(ctx.db, hashToken(signedIn.sessionToken), NOW)).not.toBeNull();
  });

  it("refuses a plain Member, a removed Owner, another Team's Owner and unknown ids", async () => {
    const team = await newTeam();
    const other = await newTeam();
    const { owner } = await ownerWithLink(team);
    const bo = await createMember(ctx.db, { teamId: team, displayName: "Bo", role: "member" });
    const gone = await ownerWithLink(team, "Gone");
    await softRemoveMember(ctx.db, { teamId: team, memberId: gone.owner.id, now: NOW });
    const before = (await ctx.db.select().from(accessLinks)).length;

    expect(await replaceOwnerLink(ctx.db, team, bo.id, NOW)).toBeNull();
    expect(await replaceOwnerLink(ctx.db, team, gone.owner.id, NOW)).toBeNull();
    expect(await replaceOwnerLink(ctx.db, other, owner.id, NOW)).toBeNull();
    expect(await replaceOwnerLink(ctx.db, team, "no-such-member", NOW)).toBeNull();
    expect((await ctx.db.select().from(accessLinks)).length).toBe(before);
  });

  it("creates the new link before revoking the old: a failed create leaves the old one working", async () => {
    const team = await newTeam();
    const { owner, token: old } = await ownerWithLink(team);
    const original = ctx.db.insert.bind(ctx.db);
    const spy = vi.spyOn(ctx.db, "insert").mockImplementation(((table: unknown) => {
      if (table === accessLinks) throw new Error("boom");
      return original(table as never);
    }) as never);
    try {
      await expect(replaceOwnerLink(ctx.db, team, owner.id, NOW)).rejects.toThrow("boom");
    } finally {
      spy.mockRestore();
    }
    expect(await works(old)).toBe(true);
  });

  it("two replacements at once never leave the Owner without a working link", async () => {
    const team = await newTeam();
    const { owner, token: old } = await ownerWithLink(team);
    const [a, b] = await Promise.all([
      replaceOwnerLink(ctx.db, team, owner.id, NOW),
      replaceOwnerLink(ctx.db, team, owner.id, NOW),
    ]);
    const working = [old, a!.token, b!.token].filter((token) => token);
    const results = await Promise.all(working.map((token) => works(token)));
    expect(results.filter(Boolean).length).toBeGreaterThanOrEqual(1);
    expect(await works(old)).toBe(false);
  });

  it("revokes only links made before the new one, never a newer one", async () => {
    const team = await newTeam();
    const { owner } = await ownerWithLink(team);
    const first = await replaceOwnerLink(ctx.db, team, owner.id, NOW);
    // A link that is newer than `first`, as a concurrent replacement would have made it.
    const newer = generateToken();
    await createAccessLink(ctx.db, {
      teamId: team,
      kind: "owner",
      tokenHash: hashToken(newer),
      memberId: owner.id,
    });
    const { revokeOwnerLinksBefore } = await import("@/data");
    const [firstRow] = await ctx.db.select().from(accessLinks).where(eq(accessLinks.id, first!.id));
    await revokeOwnerLinksBefore(ctx.db, {
      teamId: team,
      memberId: owner.id,
      keep: { id: firstRow.id, createdAt: firstRow.createdAt },
      now: NOW,
    });
    expect(await works(first!.token)).toBe(true);
    expect(await works(newer)).toBe(true);
  });
});
