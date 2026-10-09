import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createBoard,
  createIdea,
  listComments,
  setCommentHidden,
  setIdeaHidden,
  setIdeaStatus,
} from "@/data";
import type { IdeaStatus } from "@/db/schema";
import { teams } from "@/db/schema";
import { submitComment } from "@/lib/submit-comment";
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

const NOW = new Date("2026-03-01T12:00:00Z");
let counter = 0;
const visitor = (): Visitor => {
  const anonId = `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
  return { anonId, actorId: `anon:${anonId}` };
};
const ip = () => `203.0.113.${++counter % 250}`;
const newIdea = (boardId = publicBoard) =>
  createIdea(ctx.db, { boardId, title: "Idea", actorId: "anon:author" });
const commentsOf = (ideaId: string) => listComments(ctx.db, ideaId, { includeHidden: true });

describe("submitComment", () => {
  it("adds a Comment authored by the Visitor's Actor (US-2.3)", async () => {
    const idea = await newIdea();
    const who = visitor();
    const result = await submitComment(
      ctx.db,
      who,
      ip(),
      { ideaId: idea.id, body: "  Great idea  ", authorName: " Sam " },
      NOW,
    );
    expect(result.ok).toBe(true);
    const [comment] = await commentsOf(idea.id);
    expect(comment).toMatchObject({
      body: "Great idea",
      authorName: "Sam",
      actorId: who.actorId,
      hidden: false,
    });
    expect(result.ok && result.commentId).toBe(comment.id);
  });

  it("keeps Comments oldest first", async () => {
    const idea = await newIdea();
    const who = visitor();
    for (const body of ["first", "second", "third"]) {
      await submitComment(ctx.db, who, ip(), { ideaId: idea.id, body }, NOW);
    }
    expect((await commentsOf(idea.id)).map((c) => c.body)).toEqual(["first", "second", "third"]);
  });

  it("makes the display name optional", async () => {
    const idea = await newIdea();
    await submitComment(
      ctx.db,
      visitor(),
      ip(),
      { ideaId: idea.id, body: "Hi", authorName: " " },
      NOW,
    );
    expect((await commentsOf(idea.id))[0].authorName).toBeNull();
  });

  it("requires a body, and limits it to 1000 characters and the name to 40", async () => {
    const idea = await newIdea();
    const base = { ideaId: idea.id };
    const blank = await submitComment(ctx.db, visitor(), ip(), { ...base, body: "   " }, NOW);
    expect(!blank.ok && blank.error === "invalid" && blank.fieldErrors.body).toBeTruthy();

    const missing = await submitComment(ctx.db, visitor(), ip(), base, NOW);
    expect(!missing.ok && missing.error === "invalid" && missing.fieldErrors.body).toBe(
      "Enter a comment.",
    );

    const long = await submitComment(
      ctx.db,
      visitor(),
      ip(),
      { ...base, body: "x".repeat(1001) },
      NOW,
    );
    expect(!long.ok && long.error === "invalid" && long.fieldErrors.body).toBeTruthy();

    const name = await submitComment(
      ctx.db,
      visitor(),
      ip(),
      { ...base, body: "ok", authorName: "n".repeat(41) },
      NOW,
    );
    expect(!name.ok && name.error === "invalid" && name.fieldErrors.authorName).toBeTruthy();

    expect(await commentsOf(idea.id)).toHaveLength(0);
  });

  it("accepts the maximum lengths exactly", async () => {
    const idea = await newIdea();
    const result = await submitComment(
      ctx.db,
      visitor(),
      ip(),
      { ideaId: idea.id, body: "b".repeat(1000), authorName: "n".repeat(40) },
      NOW,
    );
    expect(result.ok).toBe(true);
  });

  it.each<IdeaStatus>(["open", "planned", "in_progress", "shipped", "declined"])(
    "allows commenting on an Idea with status %s",
    async (status) => {
      const idea = await newIdea();
      if (status !== "open") await setIdeaStatus(ctx.db, idea.id, status, "member:m1");
      const result = await submitComment(
        ctx.db,
        visitor(),
        ip(),
        { ideaId: idea.id, body: "Hi" },
        NOW,
      );
      expect(result.ok).toBe(true);
    },
  );

  it("silently discards a filled honeypot without creating or counting anything", async () => {
    const idea = await newIdea();
    const who = visitor();
    const address = ip();
    for (let i = 0; i < 15; i++) {
      const result = await submitComment(
        ctx.db,
        who,
        address,
        { ideaId: idea.id, body: "buy now", website: "http://spam.example" },
        NOW,
      );
      expect(result).toEqual({ ok: true, commentId: null });
    }
    expect(await commentsOf(idea.id)).toHaveLength(0);
    const real = await submitComment(ctx.db, who, address, { ideaId: idea.id, body: "Real" }, NOW);
    expect(real.ok).toBe(true);
  });

  it("answers not found for a hidden Idea and creates nothing (G2)", async () => {
    const idea = await newIdea();
    await setIdeaHidden(ctx.db, idea.id, true);
    const result = await submitComment(
      ctx.db,
      visitor(),
      ip(),
      { ideaId: idea.id, body: "Hi" },
      NOW,
    );
    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(await commentsOf(idea.id)).toHaveLength(0);
  });

  it("answers not found for a Private board's Idea or a missing Idea (G3)", async () => {
    const idea = await newIdea(privateBoard);
    expect(
      await submitComment(ctx.db, visitor(), ip(), { ideaId: idea.id, body: "Hi" }, NOW),
    ).toEqual({ ok: false, error: "not_found" });
    expect(await commentsOf(idea.id)).toHaveLength(0);
    expect(
      await submitComment(ctx.db, visitor(), ip(), { ideaId: "missing", body: "Hi" }, NOW),
    ).toEqual({ ok: false, error: "not_found" });
  });

  it("checks the Idea before the limiter: probing hidden or unknown Ideas spends no allowance", async () => {
    const hidden = await newIdea();
    await setIdeaHidden(ctx.db, hidden.id, true);
    const open = await newIdea();
    const who = visitor();
    const address = ip();
    for (let i = 0; i < 15; i++) {
      await submitComment(ctx.db, who, address, { ideaId: hidden.id, body: "Hi" }, NOW);
      await submitComment(ctx.db, who, address, { ideaId: "missing", body: "Hi" }, NOW);
    }
    const real = await submitComment(ctx.db, who, address, { ideaId: open.id, body: "Real" }, NOW);
    expect(real.ok).toBe(true);
  });

  it("refuses the 11th Comment from one cookie in 10 minutes and creates nothing", async () => {
    const idea = await newIdea();
    const who = visitor();
    const results = [];
    for (let i = 0; i < 11; i++) {
      results.push(await submitComment(ctx.db, who, ip(), { ideaId: idea.id, body: `c${i}` }, NOW));
    }
    expect(results.slice(0, 10).every((r) => r.ok)).toBe(true);
    expect(results[10]).toEqual({ ok: false, error: "rate_limited" });
    expect(await commentsOf(idea.id)).toHaveLength(10);
  });

  it("refuses the 11th Comment from one IP even with a new cookie each time", async () => {
    const idea = await newIdea();
    const address = "198.51.100.150";
    const results = [];
    for (let i = 0; i < 11; i++) {
      results.push(
        await submitComment(ctx.db, visitor(), address, { ideaId: idea.id, body: `c${i}` }, NOW),
      );
    }
    expect(results[10]).toEqual({ ok: false, error: "rate_limited" });
  });

  it("does not use up the limit on invalid input", async () => {
    const idea = await newIdea();
    const who = visitor();
    const address = ip();
    for (let i = 0; i < 20; i++) {
      await submitComment(ctx.db, who, address, { ideaId: idea.id, body: "" }, NOW);
    }
    expect(
      (await submitComment(ctx.db, who, address, { ideaId: idea.id, body: "Fine" }, NOW)).ok,
    ).toBe(true);
  });

  it("shares no allowance with Idea submissions or votes", async () => {
    const idea = await newIdea();
    const who = visitor();
    const address = ip();
    for (let i = 0; i < 10; i++) {
      await submitComment(ctx.db, who, address, { ideaId: idea.id, body: `c${i}` }, NOW);
    }
    // A different action uses a different key, so the Comment limit does not block it.
    const { submitIdea } = await import("@/lib/submit-idea");
    const submitted = await submitIdea(
      ctx.db,
      who,
      address,
      { boardId: publicBoard, title: "T" },
      NOW,
    );
    expect(submitted.ok).toBe(true);
  });

  it("does not show hidden Comments to the public list", async () => {
    const idea = await newIdea();
    const result = await submitComment(
      ctx.db,
      visitor(),
      ip(),
      { ideaId: idea.id, body: "rude" },
      NOW,
    );
    expect(result.ok && result.commentId).toBeTruthy();
    if (result.ok && result.commentId) await setCommentHidden(ctx.db, result.commentId, true);
    expect(await listComments(ctx.db, idea.id)).toHaveLength(0);
  });
});
