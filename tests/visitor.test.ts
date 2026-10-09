import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createBoard, createIdea, setIdeaHidden } from "@/data";
import { teams } from "@/db/schema";
import { newAnonId, signAnonId } from "@/lib/anon-cookie";
import { getEnv } from "@/lib/env";
import { findBoardForVisitor, findIdeaForVisitor } from "@/lib/visitor-access";
import { ANON_COOKIE, getVisitor, readVisitor } from "@/lib/visitor";
import { createTestDb } from "./helpers/db";

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

beforeEach(() => {
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
    expect(await readVisitor()).toEqual(visitor);
  });

  it("reuses the same Actor on later calls without setting another cookie", async () => {
    const first = await getVisitor();
    setSpy.mockClear();
    expect(await getVisitor()).toEqual(first);
    expect(await readVisitor()).toEqual(first);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("replaces a forged or tampered cookie with a fresh identity (G1)", async () => {
    const victim = await getVisitor();
    jar.set(ANON_COOKIE, `${victim.anonId}.forged-signature`);
    const attacker = await getVisitor();
    expect(attacker.anonId).not.toBe(victim.anonId);
    expect(await readVisitor()).toEqual(attacker);
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
