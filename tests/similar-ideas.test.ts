import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addVote, createBoard, createIdea, findSimilarIdeas, setIdeaHidden } from "@/data";
import { teams } from "@/db/schema";
import { suggestSimilarIdeas } from "@/lib/similar-ideas";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let boardId: string;
let otherBoardId: string;
let privateBoardId: string;

beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db.insert(teams).values({ id: "t1", name: "Acme", slug: "acme" });
  boardId = (await createBoard(ctx.db, { teamId: "t1", name: "A", slug: "a" })).id;
  otherBoardId = (await createBoard(ctx.db, { teamId: "t1", name: "B", slug: "b" })).id;
  privateBoardId = (
    await createBoard(ctx.db, { teamId: "t1", name: "P", slug: "p", visibility: "private" })
  ).id;
  for (const title of [
    "Dark mode for the dashboard",
    "Dark theme option",
    "Export to CSV",
    "Calendar sync",
    "Darker colours please",
  ]) {
    await createIdea(ctx.db, { boardId, title, actorId: "anon:a" });
  }
  await createIdea(ctx.db, {
    boardId: otherBoardId,
    title: "Dark mode elsewhere",
    actorId: "anon:a",
  });
  await createIdea(ctx.db, {
    boardId: privateBoardId,
    title: "Dark mode private",
    actorId: "anon:a",
  });
});

afterAll(async () => {
  await ctx.close();
});

const NOW = new Date("2026-03-01T12:00:00Z");

const titles = async (title: string, limit?: number) =>
  (await findSimilarIdeas(ctx.db, { boardId, title, limit })).map((i) => i.title);

describe("findSimilarIdeas", () => {
  it("matches on shared words in the title, stemmed, and ignores unrelated Ideas", async () => {
    const found = await titles("dark mode");
    expect(found).toContain("Dark mode for the dashboard");
    expect(found).toContain("Dark theme option");
    expect(found).not.toContain("Export to CSV");
    expect(await titles("calendars")).toEqual(["Calendar sync"]);
  });

  it("puts the closest match first", async () => {
    expect((await titles("dark mode dashboard"))[0]).toBe("Dark mode for the dashboard");
  });

  it("returns at most 3 by default and honours a smaller limit", async () => {
    await createIdea(ctx.db, { boardId, title: "Dark dark dark", actorId: "anon:a" });
    expect((await titles("dark")).length).toBeLessThanOrEqual(3);
    expect(await titles("dark", 1)).toHaveLength(1);
  });

  it("searches the title only, not the description", async () => {
    await createIdea(ctx.db, {
      boardId,
      title: "Unrelated heading",
      description: "mentions zebra stripes",
      actorId: "anon:a",
    });
    expect(await titles("zebra")).toEqual([]);
  });

  it("stays on its own Board and skips hidden Ideas", async () => {
    expect(await titles("elsewhere")).toEqual([]);
    const hidden = await createIdea(ctx.db, { boardId, title: "Hidden gem", actorId: "anon:a" });
    await setIdeaHidden(ctx.db, hidden.id, true);
    expect(await titles("hidden gem")).toEqual([]);
  });

  it("breaks ties by votes", async () => {
    // Created in the opposite order to the expected result, with three ties to rule out luck.
    const low = await createIdea(ctx.db, { boardId, title: "Widget low", actorId: "anon:a" });
    const mid = await createIdea(ctx.db, { boardId, title: "Widget mid", actorId: "anon:a" });
    const top = await createIdea(ctx.db, { boardId, title: "Widget top", actorId: "anon:a" });
    for (const voter of ["v1", "v2", "v3"]) await addVote(ctx.db, top.id, `anon:${voter}`);
    for (const voter of ["v1", "v2"]) await addVote(ctx.db, mid.id, `anon:${voter}`);
    await addVote(ctx.db, low.id, "anon:v1");
    expect(await titles("widget")).toEqual(["Widget top", "Widget mid", "Widget low"]);
  });

  it("is safe with punctuation, operators and empty input", async () => {
    expect(await titles("")).toEqual([]);
    expect(await titles("   ")).toEqual([]);
    expect(await titles("a")).toEqual([]);
    for (const hostile of [
      "dark & | ! ( ) : * '",
      "'; drop table ideas; --",
      "<->",
      "\\",
      "dark:*",
    ]) {
      await expect(titles(hostile)).resolves.toBeInstanceOf(Array);
    }
  });

  it("copes with only stop words", async () => {
    await expect(titles("the and of")).resolves.toEqual([]);
  });
});

describe("suggestSimilarIdeas", () => {
  it("returns hints for a public Board", async () => {
    const result = await suggestSimilarIdeas(ctx.db, "203.0.113.1", {
      boardId,
      title: "dark mode",
    });
    expect(result.ok && result.ideas.length).toBeGreaterThan(0);
  });

  it("returns nothing for titles under 3 characters without spending the limit", async () => {
    const result = await suggestSimilarIdeas(ctx.db, "203.0.113.2", { boardId, title: "da" });
    expect(result).toEqual({ ok: true, ideas: [] });
    for (let i = 0; i < 40; i++) {
      await suggestSimilarIdeas(ctx.db, "203.0.113.2", { boardId, title: "da" }, NOW);
    }
    const real = await suggestSimilarIdeas(ctx.db, "203.0.113.2", { boardId, title: "dark" }, NOW);
    expect(real.ok).toBe(true);
  });

  it("answers not found for a Private or unknown Board (G3)", async () => {
    expect(
      await suggestSimilarIdeas(ctx.db, "203.0.113.3", {
        boardId: privateBoardId,
        title: "dark mode",
      }),
    ).toEqual({ ok: false, error: "not_found" });
    expect(
      await suggestSimilarIdeas(ctx.db, "203.0.113.3", { boardId: "nope", title: "dark mode" }),
    ).toEqual({ ok: false, error: "not_found" });
  });

  it("is rate limited per IP: the 31st request in a minute is refused", async () => {
    const results = [];
    for (let i = 0; i < 31; i++) {
      results.push(
        await suggestSimilarIdeas(ctx.db, "198.51.100.99", { boardId, title: "dark mode" }, NOW),
      );
    }
    expect(results.slice(0, 30).every((r) => r.ok)).toBe(true);
    expect(results[30]).toEqual({ ok: false, error: "rate_limited" });
  });

  it("caps an over-long title instead of failing", async () => {
    const result = await suggestSimilarIdeas(ctx.db, "203.0.113.4", {
      boardId,
      title: "dark ".repeat(100),
    });
    expect(result.ok).toBe(true);
  });
});
