import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMember, createSession } from "@/data";
import { teams } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/link-token";
import { createTestDb } from "./helpers/db";

const jar = new Map<string, string>();
const setSpy = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string, options: unknown) => {
      setSpy(name, value, options);
      jar.set(name, value);
    },
  }),
}));

vi.mock("next/server", () => ({ connection: async () => {} }));

let ctx: Awaited<ReturnType<typeof createTestDb>>;
vi.mock("@/db", () => ({ getDb: () => ctx.db }));

const { getSession, SESSION_COOKIE, setSessionCookie } = await import("@/lib/session");

beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db.insert(teams).values({ id: "t1", name: "Acme", slug: "acme" });
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(() => {
  jar.clear();
  setSpy.mockClear();
});

describe("Session cookie", () => {
  it("is HTTP-only, lax, site-wide and expires with the Session", async () => {
    const expiresAt = new Date("2026-04-01T00:00:00Z");
    await setSessionCookie("tok", expiresAt);
    expect(setSpy).toHaveBeenCalledWith(
      SESSION_COOKIE,
      "tok",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt }),
    );
  });

  it("getSession finds the Member and Team for a live Session", async () => {
    const member = await createMember(ctx.db, { teamId: "t1", displayName: "Ada", role: "owner" });
    const token = generateToken();
    await createSession(ctx.db, {
      tokenHash: hashToken(token),
      memberId: member.id,
      expiresAt: new Date(Date.now() + 60_000),
    });
    jar.set(SESSION_COOKIE, token);
    const session = await getSession();
    expect(session?.member.id).toBe(member.id);
    expect(session?.team.slug).toBe("acme");
  });

  it("getSession is null for no cookie, a forged cookie and an expired Session", async () => {
    expect(await getSession()).toBeNull();
    jar.set(SESSION_COOKIE, generateToken());
    expect(await getSession()).toBeNull();
    jar.set(SESSION_COOKIE, "not-a-token");
    expect(await getSession()).toBeNull();

    const member = await createMember(ctx.db, { teamId: "t1", displayName: "Old", role: "member" });
    const token = generateToken();
    await createSession(ctx.db, {
      tokenHash: hashToken(token),
      memberId: member.id,
      expiresAt: new Date(Date.now() - 1000),
    });
    jar.set(SESSION_COOKIE, token);
    expect(await getSession()).toBeNull();
  });

  it("does not accept the stored hash as the cookie value", async () => {
    const member = await createMember(ctx.db, {
      teamId: "t1",
      displayName: "Hash",
      role: "member",
    });
    const token = generateToken();
    await createSession(ctx.db, {
      tokenHash: hashToken(token),
      memberId: member.id,
      expiresAt: new Date(Date.now() + 60_000),
    });
    jar.set(SESSION_COOKIE, hashToken(token));
    expect(await getSession()).toBeNull();
  });
});
