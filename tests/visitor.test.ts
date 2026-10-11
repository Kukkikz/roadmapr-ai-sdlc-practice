import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createBoard, createIdea, setIdeaHidden } from "@/data";
import { teams } from "@/db/schema";
import { newAnonId, signAnonId } from "@/lib/anon-cookie";
import { getEnv } from "@/lib/env";
import { rateLimitKey } from "@/lib/rate-limit";
import { findBoardForVisitor, findIdeaForVisitor } from "@/lib/visitor-access";
import { ANON_COOKIE, getVisitor, readVisitor, type Visitor } from "@/lib/visitor";
import { createTestDb } from "./helpers/db";

// The signed-in Member (or null) that `getSession` reports.
const sessionRef = vi.hoisted(() => ({
  current: null as null | {
    member: { id: string; teamId: string; displayName: string };
    team: { id: string };
  },
}));
vi.mock("@/lib/session", () => ({ getSession: async () => sessionRef.current }));

// A minimal cookie jar standing in for Next's request cookies.
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

// The identity part of a Visitor, without the Private-board access `getVisitor` adds.
const bare = (visitor: Visitor | null) => {
  const { access, ...identity } = visitor!;
  void access;
  return identity;
};

beforeEach(() => {
  sessionRef.current = null;
  jar.clear();
  setSpy.mockClear();
});

describe("getVisitor / readVisitor", () => {
  it("readVisitor is null without a cookie and never sets one", async () => {
    expect(await readVisitor()).toBeNull();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("getVisitor issues a signed, HTTP-only cookie on first use", async () => {
    const visitor = await getVisitor();
    expect(visitor.actorId).toBe(`anon:${visitor.anonId}`);
    expect(setSpy).toHaveBeenCalledOnce();
    const [name, value, options] = setSpy.mock.calls[0];
    expect(name).toBe(ANON_COOKIE);
    expect(value).toBe(signAnonId(visitor.anonId, getEnv().SESSION_SECRET));
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(options.maxAge).toBeGreaterThan(0);
  });

  it("marks the cookie Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      await getVisitor();
      expect(setSpy.mock.calls[0][2]).toMatchObject({ secure: true });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("replaces a validly shaped cookie signed with another secret", async () => {
    const stranger = signAnonId(newAnonId(), "z".repeat(32));
    jar.set(ANON_COOKIE, stranger);
    const visitor = await getVisitor();
    expect(jar.get(ANON_COOKIE)).not.toBe(stranger);
    expect(bare(await readVisitor())).toEqual(bare(visitor));
  });

  it("reuses the same Actor on later calls without setting another cookie", async () => {
    const first = await getVisitor();
    setSpy.mockClear();
    expect(bare(await getVisitor())).toEqual(bare(first));
    expect(bare(await readVisitor())).toEqual(bare(first));
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("replaces a forged or tampered cookie with a fresh identity (G1)", async () => {
    const victim = await getVisitor();
    jar.set(ANON_COOKIE, `${victim.anonId}.forged-signature`);
    const attacker = await getVisitor();
    expect(attacker.anonId).not.toBe(victim.anonId);
    expect(bare(await readVisitor())).toEqual(bare(attacker));
  });
});

describe("a signed-in Member (G1)", () => {
  it("acts as member:<id>, never as their anonymous cookie", async () => {
    const anon = await getVisitor();
    sessionRef.current = {
      member: { id: "m1", teamId: "t1", displayName: "Olga" },
      team: { id: "t1" },
    };
    const expected = {
      anonId: "member:m1",
      actorId: "member:m1",
      memberId: "m1",
      teamId: "t1",
      displayName: "Olga",
    };
    expect(await readVisitor()).toMatchObject(expected);
    expect(await getVisitor()).toMatchObject(expected);
    expect((await getVisitor()).actorId).not.toBe(anon.actorId);
  });

  it("is not issued an anonymous cookie", async () => {
    sessionRef.current = {
      member: { id: "m1", teamId: "t1", displayName: "Olga" },
      team: { id: "t1" },
    };
    await getVisitor();
    expect(setSpy).not.toHaveBeenCalled();
    expect(jar.has(ANON_COOKIE)).toBe(false);
  });

  it("goes back to the anonymous identity after signing out", async () => {
    const anon = await getVisitor();
    sessionRef.current = {
      member: { id: "m1", teamId: "t1", displayName: "Olga" },
      team: { id: "t1" },
    };
    expect((await readVisitor())?.actorId).toBe("member:m1");
    sessionRef.current = null;
    expect(bare(await readVisitor())).toEqual(bare(anon));
  });

  it("gets a rate-limit identity of their own, never a Visitor's", async () => {
    sessionRef.current = {
      member: { id: "m1", teamId: "t1", displayName: "Olga" },
      team: { id: "t1" },
    };
    const member = await getVisitor();
    sessionRef.current = {
      member: { id: "m2", teamId: "t1", displayName: "Bo" },
      team: { id: "t1" },
    };
    const other = await getVisitor();
    const anon = await (async () => {
      sessionRef.current = null;
      return getVisitor();
    })();
    expect(member.anonId).not.toBe(other.anonId);
    expect(member.anonId).toMatch(/^member:/);
    // The limiter keys differ, so a Member and a Visitor never share an allowance.
    const key = (who: { anonId: string }) => rateLimitKey("submit", "anon", who.anonId);
    expect(new Set([key(member), key(other), key(anon)]).size).toBe(3);
  });
});

describe("findBoardForVisitor / findIdeaForVisitor (G2, G3)", () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>;
  let publicBoard: string;
  let privateBoard: string;

  beforeAll(async () => {
    ctx = await createTestDb();
    await ctx.db.insert(teams).values({ id: "t1", name: "Acme", slug: "acme" });
    publicBoard = (await createBoard(ctx.db, { teamId: "t1", name: "Pub", slug: "pub" })).id;
    privateBoard = (
      await createBoard(ctx.db, { teamId: "t1", name: "Priv", slug: "priv", visibility: "private" })
    ).id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  const idea = (boardId: string) => createIdea(ctx.db, { boardId, title: "T", actorId: "anon:a" });

  it("resolves a public Board and refuses a private or missing one", async () => {
    expect((await findBoardForVisitor(ctx.db, publicBoard))?.id).toBe(publicBoard);
    expect(await findBoardForVisitor(ctx.db, privateBoard)).toBeNull();
    expect(await findBoardForVisitor(ctx.db, "missing")).toBeNull();
  });

  it("resolves a visible Idea on a public Board", async () => {
    const created = await idea(publicBoard);
    const found = await findIdeaForVisitor(ctx.db, created.id);
    expect(found?.idea.id).toBe(created.id);
    expect(found?.board.id).toBe(publicBoard);
  });

  it("refuses a hidden Idea, so votes and comments on it are not found", async () => {
    const created = await idea(publicBoard);
    await setIdeaHidden(ctx.db, created.id, true);
    expect(await findIdeaForVisitor(ctx.db, created.id)).toBeNull();
    await setIdeaHidden(ctx.db, created.id, false);
    expect(await findIdeaForVisitor(ctx.db, created.id)).not.toBeNull();
  });

  it("refuses an Idea on a private Board and a missing Idea", async () => {
    const created = await idea(privateBoard);
    expect(await findIdeaForVisitor(ctx.db, created.id)).toBeNull();
    expect(await findIdeaForVisitor(ctx.db, "missing")).toBeNull();
  });
});

describe("getVisitor carries the requester's Private-board access (G3)", () => {
  it("holds the Session's Team and the grants in the signed cookie", async () => {
    const { signBoardGrants } = await import("@/lib/board-grants");
    const { BOARD_ACCESS_COOKIE } = await import("@/lib/board-access-server");
    sessionRef.current = {
      member: { id: "m1", teamId: "t1", displayName: "Olga" },
      team: { id: "t1" },
    };
    const grants = [{ boardId: "b1", linkId: "l1" }];
    jar.set(BOARD_ACCESS_COOKIE, signBoardGrants(grants, getEnv().SESSION_SECRET));
    expect((await getVisitor()).access).toEqual({ teamId: "t1", grants });
  });

  it("ignores a forged grants cookie", async () => {
    const { BOARD_ACCESS_COOKIE } = await import("@/lib/board-access-server");
    jar.set(BOARD_ACCESS_COOKIE, "eyJ4IjoxfQ.forged");
    expect((await getVisitor()).access).toEqual({ teamId: undefined, grants: [] });
  });
});
