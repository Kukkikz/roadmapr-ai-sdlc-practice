import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkRateLimit, purgeRateLimits } from "@/data";
import { rateLimits } from "@/db/schema";
import { RATE_LIMITS, enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.close();
});

const T0 = new Date("2026-01-01T00:00:00Z");
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

describe("checkRateLimit", () => {
  it("allows up to the limit inside a window, then refuses", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await checkRateLimit(ctx.db, "k1", 3, 60, at(i)));
    expect(results).toEqual([true, true, true, false]);
  });

  it("keeps counting refused attempts, so hammering does not reset the window", async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit(ctx.db, "k2", 1, 60, at(i));
    expect(await checkRateLimit(ctx.db, "k2", 1, 60, at(59))).toBe(false);
  });

  it("starts a fresh window afterwards", async () => {
    await checkRateLimit(ctx.db, "k3", 1, 60, at(0));
    expect(await checkRateLimit(ctx.db, "k3", 1, 60, at(30))).toBe(false);
    expect(await checkRateLimit(ctx.db, "k3", 1, 60, at(61))).toBe(true);
  });

  it("limits each key on its own", async () => {
    expect(await checkRateLimit(ctx.db, "a", 1, 60, at(0))).toBe(true);
    expect(await checkRateLimit(ctx.db, "b", 1, 60, at(0))).toBe(true);
    expect(await checkRateLimit(ctx.db, "a", 1, 60, at(1))).toBe(false);
  });

  it("counts concurrent requests exactly (atomic upsert)", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => checkRateLimit(ctx.db, "race", 4, 60, at(0))),
    );
    expect(results.filter(Boolean)).toHaveLength(4);
  });
});

describe("purgeRateLimits", () => {
  it("removes windows that ended before the cut-off and keeps newer ones", async () => {
    await checkRateLimit(ctx.db, "old", 5, 60, at(0));
    await checkRateLimit(ctx.db, "new", 5, 60, at(3600));
    await purgeRateLimits(ctx.db, at(600));
    const keys = (await ctx.db.select({ key: rateLimits.key }).from(rateLimits)).map((r) => r.key);
    expect(keys).not.toContain("old");
    expect(keys).toContain("new");
  });
});

describe("rateLimitKey", () => {
  it("is a hash: it never contains the raw IP or anonymous ID", () => {
    const key = rateLimitKey("submit", "ip", "203.0.113.7");
    expect(key).not.toContain("203.0.113.7");
    expect(key.startsWith("submit:ip:")).toBe(true);
    expect(rateLimitKey("submit", "ip", "203.0.113.7")).toBe(key);
    expect(rateLimitKey("submit", "ip", "203.0.113.8")).not.toBe(key);
  });

  it("separates actions and scopes", () => {
    expect(rateLimitKey("vote", "ip", "x")).not.toBe(rateLimitKey("submit", "ip", "x"));
    expect(rateLimitKey("submit", "anon", "x")).not.toBe(rateLimitKey("submit", "ip", "x"));
  });
});

describe("enforceRateLimit (SPEC G5 table)", () => {
  it("matches the SPEC table", () => {
    expect(RATE_LIMITS.submit).toMatchObject({
      limit: 5,
      windowSeconds: 600,
      scopes: ["anon", "ip"],
    });
    expect(RATE_LIMITS.comment).toMatchObject({
      limit: 10,
      windowSeconds: 600,
      scopes: ["anon", "ip"],
    });
    expect(RATE_LIMITS.vote).toMatchObject({ limit: 60, windowSeconds: 60, scopes: ["ip"] });
    expect(RATE_LIMITS.similar).toMatchObject({ limit: 30, windowSeconds: 60, scopes: ["ip"] });
    expect(RATE_LIMITS.createTeam).toMatchObject({ limit: 3, windowSeconds: 3600, scopes: ["ip"] });
  });

  it("refuses the 6th submission from one cookie even when the IP changes", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) {
      const who = { anonId: "cookie-1", ip: `203.0.113.${i}` };
      results.push(await enforceRateLimit(ctx.db, "submit", who, at(i)));
    }
    expect(results).toEqual([true, true, true, true, true, false]);
  });

  it("refuses the 6th submission from one IP even when the cookie changes", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) {
      const who = { anonId: `cookie-${100 + i}`, ip: "198.51.100.1" };
      results.push(await enforceRateLimit(ctx.db, "submit", who, at(i)));
    }
    expect(results).toEqual([true, true, true, true, true, false]);
  });

  it("does not spend the IP allowance on a cookie that is already refused", async () => {
    for (let i = 0; i < 5; i++) {
      await enforceRateLimit(ctx.db, "submit", { anonId: "cookie-a", ip: "192.0.2.50" }, at(i));
    }
    // cookie-a is exhausted, so this refused attempt must not count against 192.0.2.1.
    const refused = { anonId: "cookie-a", ip: "192.0.2.1" };
    expect(await enforceRateLimit(ctx.db, "submit", refused, at(6))).toBe(false);
    for (let i = 0; i < 5; i++) {
      const who = { anonId: `cookie-b${i}`, ip: "192.0.2.1" };
      expect(await enforceRateLimit(ctx.db, "submit", who, at(7 + i))).toBe(true);
    }
  });

  it("limits votes per IP only", async () => {
    const results = [];
    for (let i = 0; i < 61; i++) {
      const who = { anonId: `v${i}`, ip: "192.0.2.77" };
      results.push(await enforceRateLimit(ctx.db, "vote", who, at(0)));
    }
    expect(results.slice(0, 60).every(Boolean)).toBe(true);
    expect(results[60]).toBe(false);
  });

  it("stores no raw IP or anonymous ID in rate_limits", async () => {
    const rows = await ctx.db.select({ key: rateLimits.key }).from(rateLimits);
    expect(rows.length).toBeGreaterThan(0);
    for (const { key } of rows) {
      expect(key).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
      expect(key).not.toContain("cookie-");
    }
  });
});
