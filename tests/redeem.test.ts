import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createAccessLink,
  createMember,
  findSessionByHash,
  purgeExpiredSessions,
  revokeAccessLink,
} from "@/data";
import { accessLinks, members, sessions, teams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateToken, hashToken } from "@/lib/link-token";
import { previewLink, redeemLink, SESSION_LIFETIME_MS } from "@/lib/redeem";
import { createTestDb } from "./helpers/db";
import { removeMemberUnguarded } from "./helpers/members";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;
const NOW = new Date("2026-03-01T12:00:00Z");
const ip = () => `198.51.100.${++counter % 250}`;

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

/** An Owner with an Owner link; returns the raw token (the only copy that exists). */
async function ownerLink(teamId?: string) {
  const team = teamId ?? (await newTeam());
  const owner = await createMember(ctx.db, { teamId: team, displayName: "Ada", role: "owner" });
  const token = generateToken();
  const link = await createAccessLink(ctx.db, {
    teamId: team,
    kind: "owner",
    tokenHash: hashToken(token),
    memberId: owner.id,
  });
  return { team, owner, token, link };
}

async function inviteLink(options: { expiresAt?: Date; teamId?: string } = {}) {
  const team = options.teamId ?? (await newTeam());
  const token = generateToken();
  const link = await createAccessLink(ctx.db, {
    teamId: team,
    kind: "member_invite",
    tokenHash: hashToken(token),
    expiresAt: options.expiresAt ?? new Date(NOW.getTime() + 7 * 24 * 3600 * 1000),
  });
  return { team, token, link };
}

const memberCount = async (teamId: string) =>
  (await ctx.db.select().from(members).where(eq(members.teamId, teamId))).length;

describe("Owner link (US-3.2)", () => {
  it("previews without consuming and shows the Team name", async () => {
    const { token } = await ownerLink();
    const first = await previewLink(ctx.db, "owner", token, NOW);
    expect(first).toMatchObject({ ok: true, needsName: false });
    expect(await previewLink(ctx.db, "owner", token, NOW)).toEqual(first);
    expect(await redeemLink(ctx.db, ip(), "owner", token, {}, NOW)).toMatchObject({ ok: true });
  });

  it("signs the Owner in with a 30-day, non-sliding Session", async () => {
    const { token, owner, team } = await ownerLink();
    const result = await redeemLink(ctx.db, ip(), "owner", token, {}, NOW);
    if (!result.ok) throw new Error("expected success");
    expect(result.expiresAt.getTime()).toBe(NOW.getTime() + SESSION_LIFETIME_MS);

    const hash = hashToken(result.sessionToken);
    const live = await findSessionByHash(ctx.db, hash, new Date(NOW.getTime() + 1000));
    expect(live?.member.id).toBe(owner.id);
    expect(live?.team.id).toBe(team);
    // Looking the Session up never extends it.
    const justBefore = new Date(NOW.getTime() + SESSION_LIFETIME_MS - 1);
    expect(await findSessionByHash(ctx.db, hash, justBefore)).not.toBeNull();
    const atExpiry = new Date(NOW.getTime() + SESSION_LIFETIME_MS);
    expect(await findSessionByHash(ctx.db, hash, atExpiry)).toBeNull();
  });

  it("stays valid after use and issues a different Session token every time", async () => {
    const { token } = await ownerLink();
    const a = await redeemLink(ctx.db, ip(), "owner", token, {}, NOW);
    const b = await redeemLink(ctx.db, ip(), "owner", token, {}, NOW);
    if (!a.ok || !b.ok) throw new Error("expected success");
    expect(a.sessionToken).not.toBe(b.sessionToken);
  });

  it("is refused at the Member invite path, and the other way round", async () => {
    const owner = await ownerLink();
    const invite = await inviteLink();
    expect(await previewLink(ctx.db, "member_invite", owner.token, NOW)).toEqual({ ok: false });
    expect(await previewLink(ctx.db, "owner", invite.token, NOW)).toEqual({ ok: false });
    expect(
      await redeemLink(ctx.db, ip(), "member_invite", owner.token, { displayName: "X" }, NOW),
    ).toEqual({ ok: false, error: "invalid" });
    expect(await redeemLink(ctx.db, ip(), "owner", invite.token, {}, NOW)).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("is not valid once revoked (a replaced link)", async () => {
    const { token, link } = await ownerLink();
    await revokeAccessLink(ctx.db, link.id, NOW);
    expect(await previewLink(ctx.db, "owner", token, NOW)).toEqual({ ok: false });
    expect(await redeemLink(ctx.db, ip(), "owner", token, {}, NOW)).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("is not valid once its Owner was removed (G8)", async () => {
    const { token, owner } = await ownerLink();
    await removeMemberUnguarded(ctx.db, owner.id, NOW);
    expect(await previewLink(ctx.db, "owner", token, NOW)).toEqual({ ok: false });
  });

  it("is not valid if the link and its Member belong to different Teams", async () => {
    const other = await ownerLink();
    const team = await newTeam();
    const token = generateToken();
    await createAccessLink(ctx.db, {
      teamId: team,
      kind: "owner",
      tokenHash: hashToken(token),
      memberId: other.owner.id,
    });
    expect(await previewLink(ctx.db, "owner", token, NOW)).toEqual({ ok: false });
    expect(await redeemLink(ctx.db, ip(), "owner", token, {}, NOW)).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("is not valid if the linked Member is not an Owner", async () => {
    const team = await newTeam();
    const plain = await createMember(ctx.db, { teamId: team, displayName: "Bo", role: "member" });
    const token = generateToken();
    await createAccessLink(ctx.db, {
      teamId: team,
      kind: "owner",
      tokenHash: hashToken(token),
      memberId: plain.id,
    });
    expect(await previewLink(ctx.db, "owner", token, NOW)).toEqual({ ok: false });
  });
});

describe("Member invite link (US-3.3)", () => {
  it("asks for a display name and creates a Member with role member and a Session", async () => {
    const { token, team } = await inviteLink();
    expect(await previewLink(ctx.db, "member_invite", token, NOW)).toMatchObject({
      ok: true,
      needsName: true,
    });
    const result = await redeemLink(
      ctx.db,
      ip(),
      "member_invite",
      token,
      { displayName: "  Bo Builder  " },
      NOW,
    );
    if (!result.ok) throw new Error("expected success");
    const live = await findSessionByHash(ctx.db, hashToken(result.sessionToken), NOW);
    expect(live?.member).toMatchObject({
      displayName: "Bo Builder",
      role: "member",
      teamId: team,
    });
  });

  it("is multi-use: each redeem is a new Member", async () => {
    const { token, team } = await inviteLink();
    await redeemLink(ctx.db, ip(), "member_invite", token, { displayName: "One" }, NOW);
    await redeemLink(ctx.db, ip(), "member_invite", token, { displayName: "Two" }, NOW);
    expect(await memberCount(team)).toBe(2);
  });

  it("previewing never creates a Member", async () => {
    const { token, team } = await inviteLink();
    await previewLink(ctx.db, "member_invite", token, NOW);
    await previewLink(ctx.db, "member_invite", token, NOW);
    expect(await memberCount(team)).toBe(0);
  });

  it.each([
    ["empty", ""],
    ["blank", "   "],
    ["too long", "x".repeat(41)],
    ["missing", undefined],
    ["not text", { name: "Mallory" }],
  ])("rejects a %s display name and creates nothing", async (_label, displayName) => {
    const { token, team } = await inviteLink();
    const before = (await ctx.db.select().from(sessions)).length;
    const result = await redeemLink(ctx.db, ip(), "member_invite", token, { displayName }, NOW);
    expect(result).toMatchObject({ ok: false, error: "invalid_name" });
    expect(await memberCount(team)).toBe(0);
    expect((await ctx.db.select().from(sessions)).length).toBe(before);
  });

  it("is not valid once expired (exactly at expiry too)", async () => {
    const expiresAt = new Date(NOW.getTime() + 1000);
    const { token } = await inviteLink({ expiresAt });
    expect(await previewLink(ctx.db, "member_invite", token, NOW)).toMatchObject({ ok: true });
    expect(await previewLink(ctx.db, "member_invite", token, expiresAt)).toEqual({ ok: false });
    expect(
      await redeemLink(ctx.db, ip(), "member_invite", token, { displayName: "Late" }, expiresAt),
    ).toEqual({ ok: false, error: "invalid" });
  });

  it("is not valid once revoked", async () => {
    const { token, link, team } = await inviteLink();
    await revokeAccessLink(ctx.db, link.id, NOW);
    expect(
      await redeemLink(ctx.db, ip(), "member_invite", token, { displayName: "Eve" }, NOW),
    ).toEqual({ ok: false, error: "invalid" });
    expect(await memberCount(team)).toBe(0);
  });
});

describe("Session replacement and cleanup", () => {
  it("ends the Session the browser held before when it signs in again", async () => {
    const { token } = await ownerLink();
    const first = await redeemLink(ctx.db, ip(), "owner", token, {}, NOW);
    if (!first.ok) throw new Error("expected success");
    const second = await redeemLink(
      ctx.db,
      ip(),
      "owner",
      token,
      { previousSessionToken: first.sessionToken },
      NOW,
    );
    if (!second.ok) throw new Error("expected success");
    expect(await findSessionByHash(ctx.db, hashToken(first.sessionToken), NOW)).toBeNull();
    expect(await findSessionByHash(ctx.db, hashToken(second.sessionToken), NOW)).not.toBeNull();
  });

  it("ignores a junk previous token and keeps other devices' Sessions", async () => {
    const { token } = await ownerLink();
    const device = await redeemLink(ctx.db, ip(), "owner", token, {}, NOW);
    if (!device.ok) throw new Error("expected success");
    const again = await redeemLink(
      ctx.db,
      ip(),
      "owner",
      token,
      { previousSessionToken: "junk" },
      NOW,
    );
    expect(again).toMatchObject({ ok: true });
    expect(await findSessionByHash(ctx.db, hashToken(device.sessionToken), NOW)).not.toBeNull();
  });

  it("does not end the previous Session when the redeem is refused", async () => {
    const { token } = await ownerLink();
    const first = await redeemLink(ctx.db, ip(), "owner", token, {}, NOW);
    if (!first.ok) throw new Error("expected success");
    const refused = await redeemLink(
      ctx.db,
      ip(),
      "owner",
      generateToken(),
      { previousSessionToken: first.sessionToken },
      NOW,
    );
    expect(refused).toEqual({ ok: false, error: "invalid" });
    expect(await findSessionByHash(ctx.db, hashToken(first.sessionToken), NOW)).not.toBeNull();
  });

  it("purgeExpiredSessions deletes only expired Sessions", async () => {
    const { token } = await ownerLink();
    const live = await redeemLink(ctx.db, ip(), "owner", token, {}, NOW);
    if (!live.ok) throw new Error("expected success");
    const old = await redeemLink(
      ctx.db,
      ip(),
      "owner",
      token,
      {},
      new Date(NOW.getTime() - SESSION_LIFETIME_MS - 1000),
    );
    if (!old.ok) throw new Error("expected success");
    await purgeExpiredSessions(ctx.db, NOW);
    const stored = (await ctx.db.select().from(sessions)).map((row) => row.tokenHash);
    expect(stored).toContain(hashToken(live.sessionToken));
    expect(stored).not.toContain(hashToken(old.sessionToken));
  });
});

describe("tokens and Sessions are never stored raw (G4)", () => {
  it("keeps only hashes in access_links and sessions", async () => {
    const { token } = await ownerLink();
    const result = await redeemLink(ctx.db, ip(), "owner", token, {}, NOW);
    if (!result.ok) throw new Error("expected success");
    const stored = [
      ...(await ctx.db.select().from(accessLinks)).map((row) => row.tokenHash),
      ...(await ctx.db.select().from(sessions)).map((row) => row.tokenHash),
    ];
    expect(stored).not.toContain(token);
    expect(stored).not.toContain(result.sessionToken);
    expect(stored).toContain(hashToken(token));
    expect(stored).toContain(hashToken(result.sessionToken));
  });

  it("does not accept a stored hash as if it were the token", async () => {
    const { token } = await ownerLink();
    expect(await previewLink(ctx.db, "owner", hashToken(token), NOW)).toEqual({ ok: false });
  });
});

describe("invalid tokens", () => {
  it.each([
    ["unknown", generateToken()],
    ["empty", ""],
    ["too short", "abc"],
    ["wrong characters", "!".repeat(43)],
    ["too long", "a".repeat(44)],
    ["not a string", 42],
    ["undefined", undefined],
  ])("%s gives the same refusal", async (_label, token) => {
    expect(await previewLink(ctx.db, "owner", token, NOW)).toEqual({ ok: false });
    expect(await redeemLink(ctx.db, ip(), "owner", token, {}, NOW)).toEqual({
      ok: false,
      error: "invalid",
    });
  });
});

describe("Sessions end with the Member and the Team (US-3.4, US-3.8)", () => {
  it("stops working as soon as the Member is removed", async () => {
    const { token, owner } = await ownerLink();
    const result = await redeemLink(ctx.db, ip(), "owner", token, {}, NOW);
    if (!result.ok) throw new Error("expected success");
    const hash = hashToken(result.sessionToken);
    expect(await findSessionByHash(ctx.db, hash, NOW)).not.toBeNull();
    await removeMemberUnguarded(ctx.db, owner.id, NOW);
    expect(await findSessionByHash(ctx.db, hash, NOW)).toBeNull();
  });

  it("is deleted with the Team", async () => {
    const { token, team } = await ownerLink();
    const result = await redeemLink(ctx.db, ip(), "owner", token, {}, NOW);
    if (!result.ok) throw new Error("expected success");
    await ctx.db.delete(teams).where(eq(teams.id, team));
    expect(await findSessionByHash(ctx.db, hashToken(result.sessionToken), NOW)).toBeNull();
    expect(await previewLink(ctx.db, "owner", token, NOW)).toEqual({ ok: false });
  });

  it("a Session of Team A says Team A, never Team B", async () => {
    const a = await ownerLink();
    const b = await ownerLink();
    const result = await redeemLink(ctx.db, ip(), "owner", a.token, {}, NOW);
    if (!result.ok) throw new Error("expected success");
    const live = await findSessionByHash(ctx.db, hashToken(result.sessionToken), NOW);
    expect(live?.team.id).toBe(a.team);
    expect(live?.team.id).not.toBe(b.team);
  });
});

describe("rate limit (G5)", () => {
  it("counts valid and invalid attempts, then refuses even a good link", async () => {
    const { token } = await ownerLink();
    const who = "203.0.113.200";
    for (let i = 0; i < 10; i++) {
      await redeemLink(ctx.db, who, "owner", generateToken(), {}, NOW);
    }
    expect(await redeemLink(ctx.db, who, "owner", token, {}, NOW)).toEqual({
      ok: false,
      error: "rate_limited",
    });
  });

  it("is per IP, and a new window starts fresh", async () => {
    const { token } = await ownerLink();
    const who = "203.0.113.201";
    for (let i = 0; i < 11; i++) await redeemLink(ctx.db, who, "owner", generateToken(), {}, NOW);
    expect(await redeemLink(ctx.db, "203.0.113.202", "owner", token, {}, NOW)).toMatchObject({
      ok: true,
    });
    const later = new Date(NOW.getTime() + 11 * 60 * 1000);
    expect(await redeemLink(ctx.db, who, "owner", token, {}, later)).toMatchObject({ ok: true });
  });

  it("does not count previews", async () => {
    const { token } = await ownerLink();
    for (let i = 0; i < 30; i++) await previewLink(ctx.db, "owner", token, NOW);
    expect(await redeemLink(ctx.db, ip(), "owner", token, {}, NOW)).toMatchObject({ ok: true });
  });
});
