import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { findSessionByHash, getTeamBySlug } from "@/data";
import { accessLinks, boards, members, sessions, teams } from "@/db/schema";
import { hashToken } from "@/lib/link-token";
import { createTeamWithOwner } from "@/lib/create-team";
import { previewLink, redeemLink } from "@/lib/redeem";
import { boardSlugFor, slugify } from "@/lib/slugs";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;
const NOW = new Date("2026-03-01T12:00:00Z");
const ip = () => `192.0.2.${++counter % 250}`;
const form = (overrides: Record<string, unknown> = {}) => {
  const n = ++counter;
  return {
    teamName: `Team ${n}`,
    teamSlug: `team-${n}`,
    boardName: "Feature requests",
    displayName: "Ada",
    ...overrides,
  };
};

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

describe("createTeamWithOwner (US-3.1)", () => {
  it("creates the Team, an Owner named by the creator, and a public first Board", async () => {
    const input = form({ displayName: "  Grace  ", boardName: "Feature requests" });
    const result = await createTeamWithOwner(ctx.db, ip(), input, { now: NOW });
    if (!result.ok) throw new Error("expected success");

    const team = await getTeamBySlug(ctx.db, input.teamSlug);
    expect(team).toMatchObject({ name: input.teamName });
    const owners = await ctx.db.select().from(members).where(eq(members.teamId, team!.id));
    expect(owners).toHaveLength(1);
    expect(owners[0]).toMatchObject({ displayName: "Grace", role: "owner", removedAt: null });
    const teamBoards = await ctx.db.select().from(boards).where(eq(boards.teamId, team!.id));
    expect(teamBoards).toHaveLength(1);
    expect(teamBoards[0]).toMatchObject({
      name: "Feature requests",
      slug: "feature-requests",
      visibility: "public",
    });
  });

  it("makes an Owner link that works, shown once: only its hash is stored", async () => {
    const input = form();
    const result = await createTeamWithOwner(ctx.db, ip(), input, { now: NOW });
    if (!result.ok) throw new Error("expected success");

    const team = (await getTeamBySlug(ctx.db, input.teamSlug))!;
    const links = await ctx.db.select().from(accessLinks).where(eq(accessLinks.teamId, team.id));
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ kind: "owner", revokedAt: null, expiresAt: null });
    expect(links[0].tokenHash).toBe(hashToken(result.ownerToken));
    expect(links[0].tokenHash).not.toBe(result.ownerToken);

    // The very link the creator is shown signs the Owner in later, on any device.
    expect(await previewLink(ctx.db, "owner", result.ownerToken, NOW)).toMatchObject({
      ok: true,
      teamName: input.teamName,
    });
    expect(await redeemLink(ctx.db, ip(), "owner", result.ownerToken, {}, NOW)).toMatchObject({
      ok: true,
    });
  });

  it("signs the creator in as that Owner for 30 days, storing only the Session hash", async () => {
    const input = form();
    const result = await createTeamWithOwner(ctx.db, ip(), input, { now: NOW });
    if (!result.ok) throw new Error("expected success");
    const live = await findSessionByHash(ctx.db, hashToken(result.sessionToken), NOW);
    expect(live?.member).toMatchObject({ role: "owner", displayName: "Ada" });
    expect(live?.team.slug).toBe(input.teamSlug);
    expect(result.expiresAt.getTime()).toBe(NOW.getTime() + 30 * 24 * 3600 * 1000);
    const stored = (await ctx.db.select().from(sessions)).map((row) => row.tokenHash);
    expect(stored).not.toContain(result.sessionToken);
    expect(stored).not.toContain(result.ownerToken);
  });

  it("never issues the same Owner link twice", async () => {
    const a = await createTeamWithOwner(ctx.db, ip(), form(), { now: NOW });
    const b = await createTeamWithOwner(ctx.db, ip(), form(), { now: NOW });
    if (!a.ok || !b.ok) throw new Error("expected success");
    expect(a.ownerToken).not.toBe(b.ownerToken);
    expect(a.sessionToken).not.toBe(b.sessionToken);
  });

  it("ends the Session the browser held before", async () => {
    const first = await createTeamWithOwner(ctx.db, ip(), form(), { now: NOW });
    if (!first.ok) throw new Error("expected success");
    const second = await createTeamWithOwner(ctx.db, ip(), form(), {
      now: NOW,
      previousSessionToken: first.sessionToken,
    });
    if (!second.ok) throw new Error("expected success");
    expect(await findSessionByHash(ctx.db, hashToken(first.sessionToken), NOW)).toBeNull();
    expect(await findSessionByHash(ctx.db, hashToken(second.sessionToken), NOW)).not.toBeNull();
  });
});

describe("validation creates nothing and does not use up the limit", () => {
  const teamCount = async () => (await ctx.db.select().from(teams)).length;

  it.each([
    ["an empty team name", { teamName: "" }, "teamName"],
    ["a blank team name", { teamName: "   " }, "teamName"],
    ["a team name over 60 characters", { teamName: "x".repeat(61) }, "teamName"],
    ["a reserved slug", { teamSlug: "login" }, "teamSlug"],
    ["another reserved slug", { teamSlug: "api" }, "teamSlug"],
    ["an uppercase slug", { teamSlug: "Acme" }, "teamSlug"],
    ["a slug with spaces", { teamSlug: "my team" }, "teamSlug"],
    ["a one-letter slug", { teamSlug: "a" }, "teamSlug"],
    ["a missing board name", { boardName: undefined }, "boardName"],
    ["a board name over 60 characters", { boardName: "b".repeat(61) }, "boardName"],
    ["an empty display name", { displayName: "" }, "displayName"],
    ["a display name over 40 characters", { displayName: "d".repeat(41) }, "displayName"],
  ])("rejects %s", async (_label, override, field) => {
    const before = await teamCount();
    const result = await createTeamWithOwner(ctx.db, "192.0.2.250", form(override), { now: NOW });
    expect(result).toMatchObject({ ok: false, error: "invalid" });
    if (result.ok || result.error !== "invalid") throw new Error("expected invalid");
    expect(result.fieldErrors[field as keyof typeof result.fieldErrors]).toBeTruthy();
    expect(await teamCount()).toBe(before);
  });

  it("rejects values that are not text", async () => {
    const result = await createTeamWithOwner(
      ctx.db,
      "192.0.2.250",
      form({ teamSlug: { toString: "x" }, teamName: 7 }),
      { now: NOW },
    );
    expect(result).toMatchObject({ ok: false, error: "invalid" });
  });

  it("says a taken slug is taken, creates nothing and does not use up the limit", async () => {
    const who = "198.18.0.1";
    const taken = form();
    await createTeamWithOwner(ctx.db, ip(), taken, { now: NOW });
    const before = await teamCount();
    for (let i = 0; i < 6; i++) {
      const again = await createTeamWithOwner(ctx.db, who, form({ teamSlug: taken.teamSlug }), {
        now: NOW,
      });
      expect(again).toMatchObject({ ok: false, error: "invalid" });
      if (again.ok || again.error !== "invalid") throw new Error("expected invalid");
      expect(again.fieldErrors.teamSlug).toMatch(/taken/);
    }
    expect(await teamCount()).toBe(before);
    expect(await createTeamWithOwner(ctx.db, who, form(), { now: NOW })).toMatchObject({
      ok: true,
    });
  });
});

describe("rate limit (G5)", () => {
  it("allows 3 Teams per IP per hour, then refuses without creating anything", async () => {
    const who = "198.18.0.50";
    for (let i = 0; i < 3; i++) {
      expect(await createTeamWithOwner(ctx.db, who, form(), { now: NOW })).toMatchObject({
        ok: true,
      });
    }
    const before = (await ctx.db.select().from(teams)).length;
    const input = form();
    expect(await createTeamWithOwner(ctx.db, who, input, { now: NOW })).toEqual({
      ok: false,
      error: "rate_limited",
    });
    expect(await getTeamBySlug(ctx.db, input.teamSlug)).toBeNull();
    expect((await ctx.db.select().from(teams)).length).toBe(before);
  });

  it("is per IP, and the window ends after an hour", async () => {
    const who = "198.18.0.51";
    for (let i = 0; i < 4; i++) await createTeamWithOwner(ctx.db, who, form(), { now: NOW });
    expect(await createTeamWithOwner(ctx.db, "198.18.0.52", form(), { now: NOW })).toMatchObject({
      ok: true,
    });
    const later = new Date(NOW.getTime() + 61 * 60 * 1000);
    expect(await createTeamWithOwner(ctx.db, who, form(), { now: later })).toMatchObject({
      ok: true,
    });
  });
});

describe("no half-made Team", () => {
  it("deletes the Team again if a later step fails", async () => {
    const input = form();
    // Make the Owner link insert fail, after the Team, Owner and Board already exist.
    const original = ctx.db.insert.bind(ctx.db);
    const spy = vi.spyOn(ctx.db, "insert").mockImplementation(((table: unknown) => {
      if (table === accessLinks) throw new Error("boom");
      return original(table as never);
    }) as never);
    try {
      await expect(createTeamWithOwner(ctx.db, ip(), input, { now: NOW })).rejects.toThrow("boom");
    } finally {
      spy.mockRestore();
    }
    expect(await getTeamBySlug(ctx.db, input.teamSlug)).toBeNull();
  });
});

describe("slugs from names", () => {
  it.each([
    ["Feature requests", "feature-requests"],
    ["  Ideas & Feedback!! ", "ideas-feedback"],
    ["Café Menu", "cafe-menu"],
    ["a--b", "a-b"],
  ])("slugify(%j) is %j", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it("falls back to feedback when the name gives nothing usable", () => {
    expect(boardSlugFor("!!!")).toBe("feedback");
    expect(boardSlugFor("日本語")).toBe("feedback");
    expect(boardSlugFor("x")).toBe("feedback");
    expect(boardSlugFor("Login")).toBe("feedback");
    expect(boardSlugFor("Roadmap")).toBe("feedback");
  });

  it("never exceeds the slug limit", () => {
    expect(slugify("word ".repeat(30)).length).toBeLessThanOrEqual(40);
    expect(boardSlugFor("word ".repeat(30))).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
