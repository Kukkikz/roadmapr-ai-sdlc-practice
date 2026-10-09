import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBoard, listIdeas } from "@/data";
import { teams } from "@/db/schema";
import { submitIdea } from "@/lib/submit-idea";
import type { Visitor } from "@/lib/visitor";
import { createTestDb } from "./helpers/db";

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

let counter = 0;
const visitor = (): Visitor => {
  const anonId = `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
  return { anonId, actorId: `anon:${anonId}` };
};
const ip = () => `203.0.113.${++counter % 250}`;
const NOW = new Date("2026-03-01T12:00:00Z");
const ideasOn = (boardId: string) => listIdeas(ctx.db, { boardId, includeHidden: true });

describe("submitIdea", () => {
  it("creates an open, visible Idea authored by the Visitor's Actor (US-2.1)", async () => {
    const who = visitor();
    const result = await submitIdea(ctx.db, who, ip(), {
      boardId: publicBoard,
      title: "  Dark mode  ",
      description: "For night owls",
      authorName: " Sam ",
    });
    expect(result.ok).toBe(true);
    const [idea] = (await ideasOn(publicBoard)).filter((i) => i.title === "Dark mode");
    expect(idea).toMatchObject({
      status: "open",
      hidden: false,
      actorId: who.actorId,
      authorName: "Sam",
      description: "For night owls",
    });
    expect(result.ok && result.ideaId).toBe(idea.id);
  });

  it("makes the display name and description optional", async () => {
    const result = await submitIdea(ctx.db, visitor(), ip(), {
      boardId: publicBoard,
      title: "Just a title",
      description: "   ",
      authorName: "",
    });
    expect(result.ok).toBe(true);
    const idea = (await ideasOn(publicBoard)).find((i) => i.title === "Just a title");
    expect(idea?.authorName).toBeNull();
    expect(idea?.description).toBe("");
  });

  it("rejects a missing or blank title, and over-long fields, naming the field", async () => {
    const base = { boardId: publicBoard, title: "ok" };
    const blank = await submitIdea(ctx.db, visitor(), ip(), { ...base, title: "   " });
    expect(blank).toMatchObject({ ok: false, error: "invalid" });
    expect(!blank.ok && blank.error === "invalid" && blank.fieldErrors.title).toBeTruthy();

    const long = await submitIdea(ctx.db, visitor(), ip(), { ...base, title: "x".repeat(121) });
    expect(long).toMatchObject({ ok: false, error: "invalid" });

    const desc = await submitIdea(ctx.db, visitor(), ip(), {
      ...base,
      description: "x".repeat(2001),
    });
    expect(!desc.ok && desc.error === "invalid" && desc.fieldErrors.description).toBeTruthy();

    const name = await submitIdea(ctx.db, visitor(), ip(), { ...base, authorName: "x".repeat(41) });
    expect(!name.ok && name.error === "invalid" && name.fieldErrors.authorName).toBeTruthy();
  });

  it("names the title field when it is missing entirely (direct POST)", async () => {
    const result = await submitIdea(ctx.db, visitor(), ip(), { boardId: publicBoard });
    expect(!result.ok && result.error === "invalid" && result.fieldErrors.title).toBe(
      "Enter a title.",
    );
  });

  it("accepts the maximum lengths exactly", async () => {
    const result = await submitIdea(ctx.db, visitor(), ip(), {
      boardId: publicBoard,
      title: "t".repeat(120),
      description: "d".repeat(2000),
      authorName: "n".repeat(40),
    });
    expect(result.ok).toBe(true);
  });

  it("creates nothing when the input is invalid", async () => {
    const before = (await ideasOn(publicBoard)).length;
    await submitIdea(ctx.db, visitor(), ip(), { boardId: publicBoard, title: "" });
    expect((await ideasOn(publicBoard)).length).toBe(before);
  });

  it("silently discards a submission with the honeypot filled, creating nothing", async () => {
    const before = (await ideasOn(publicBoard)).length;
    const result = await submitIdea(ctx.db, visitor(), ip(), {
      boardId: publicBoard,
      title: "Buy cheap watches",
      website: "http://spam.example",
    });
    expect(result).toEqual({ ok: true, ideaId: null });
    expect((await ideasOn(publicBoard)).length).toBe(before);
  });

  it("does not count a honeypot hit against the rate limit", async () => {
    const who = visitor();
    const address = ip();
    for (let i = 0; i < 10; i++) {
      await submitIdea(ctx.db, who, address, { boardId: publicBoard, title: "bot", website: "x" });
    }
    const real = await submitIdea(ctx.db, who, address, {
      boardId: publicBoard,
      title: "Real one",
    });
    expect(real.ok).toBe(true);
  });

  it("answers not found for a Private board or an unknown Board, creating nothing (G3)", async () => {
    const priv = await submitIdea(ctx.db, visitor(), ip(), { boardId: privateBoard, title: "Hi" });
    expect(priv).toEqual({ ok: false, error: "not_found" });
    const missing = await submitIdea(ctx.db, visitor(), ip(), { boardId: "nope", title: "Hi" });
    expect(missing).toEqual({ ok: false, error: "not_found" });
    expect(await ideasOn(privateBoard)).toHaveLength(0);
  });

  it("refuses the 6th submission from one cookie with a slow-down error and creates nothing", async () => {
    const who = visitor();
    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push(
        await submitIdea(ctx.db, who, ip(), { boardId: publicBoard, title: `Rate ${i}` }, NOW),
      );
    }
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results[5]).toEqual({ ok: false, error: "rate_limited" });
    const titles = (await ideasOn(publicBoard)).map((i) => i.title);
    expect(titles).toContain("Rate 4");
    expect(titles).not.toContain("Rate 5");
  });

  it("refuses the 6th submission from one IP even with a new cookie each time", async () => {
    const address = "198.51.100.200";
    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push(
        await submitIdea(
          ctx.db,
          visitor(),
          address,
          { boardId: publicBoard, title: `Ip ${i}` },
          NOW,
        ),
      );
    }
    expect(results[5]).toEqual({ ok: false, error: "rate_limited" });
  });

  it("does not use up the limit on invalid input", async () => {
    const who = visitor();
    const address = ip();
    for (let i = 0; i < 10; i++) {
      await submitIdea(ctx.db, who, address, { boardId: publicBoard, title: "" });
    }
    expect(
      (await submitIdea(ctx.db, who, address, { boardId: publicBoard, title: "Fine" })).ok,
    ).toBe(true);
  });
});
