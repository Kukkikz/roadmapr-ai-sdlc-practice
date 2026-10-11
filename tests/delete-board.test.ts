import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { count } from "drizzle-orm";
import {
  addComment,
  addVote,
  assignTag,
  createBoard,
  createIdea,
  createTag,
  getBoardById,
  getBoardBySlugs,
} from "@/data";
import { accessLinks, comments, ideaTags, ideas, tags, teams, votes } from "@/db/schema";
import { rotateBoardShareLink } from "@/lib/board-share-links";
import { createBoardForTeam } from "@/lib/create-board";
import { deleteBoardConfirmed } from "@/lib/delete-board";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

async function newTeam() {
  const n = ++counter;
  const team = { id: `team-${n}`, name: `Team ${n}`, slug: `team-${n}` };
  await ctx.db.insert(teams).values(team);
  return team;
}
const newBoard = (teamId: string, name = `Board ${++counter}`, slug = `board-${counter}`) =>
  createBoard(ctx.db, { teamId, name, slug, visibility: "private" });
const total = async (table: typeof ideas | typeof votes | typeof comments | typeof tags) =>
  Number((await ctx.db.select({ n: count() }).from(table))[0].n);

/** An Idea with a Vote, a Comment and a Tag on it, plus a share link for the Board. */
async function fill(teamId: string, boardId: string) {
  const idea = await createIdea(ctx.db, { boardId, title: "Idea", actorId: "anon:a" });
  await addVote(ctx.db, idea.id, "anon:a");
  await addComment(ctx.db, { ideaId: idea.id, body: "Hi", actorId: "anon:a" });
  const tag = await createTag(ctx.db, { boardId, name: "bug", color: "#ff0000" });
  await assignTag(ctx.db, idea.id, tag.id);
  await rotateBoardShareLink(ctx.db, teamId, boardId);
  return idea;
}

describe("deleteBoardConfirmed (US-4.3, G8)", () => {
  it("deletes the Board and everything under it, and frees the slug", async () => {
    const team = await newTeam();
    const board = await newBoard(team.id, "Roadmap talk", "roadmap-talk");
    const keep = await newBoard(team.id, "Keep me", "keep-me");
    const doomed = await fill(team.id, board.id);
    const kept = await fill(team.id, keep.id);

    expect(await deleteBoardConfirmed(ctx.db, team.id, board.id, "Roadmap talk")).toBe("deleted");

    expect(await getBoardById(ctx.db, board.id)).toBeNull();
    expect(await getBoardBySlugs(ctx.db, team.slug, "roadmap-talk")).toBeNull();
    // Only the other Board's rows are left.
    expect(await total(ideas)).toBeGreaterThanOrEqual(1);
    expect((await ctx.db.select().from(ideas)).every((i) => i.boardId !== board.id)).toBe(true);
    expect((await ctx.db.select().from(tags)).every((t) => t.boardId !== board.id)).toBe(true);
    expect((await ctx.db.select().from(ideaTags)).every((t) => t.boardId !== board.id)).toBe(true);
    expect((await ctx.db.select().from(accessLinks)).every((l) => l.boardId !== board.id)).toBe(
      true,
    );
    expect((await ctx.db.select().from(votes)).some((v) => v.ideaId === kept.id)).toBe(true);
    expect((await ctx.db.select().from(comments)).some((c) => c.ideaId === kept.id)).toBe(true);
    expect((await ctx.db.select().from(votes)).some((v) => v.ideaId === doomed.id)).toBe(false);
    expect((await ctx.db.select().from(comments)).some((c) => c.ideaId === doomed.id)).toBe(false);
    expect(await getBoardById(ctx.db, keep.id)).not.toBeNull();

    const again = await createBoardForTeam(ctx.db, team, { name: "New", slug: "roadmap-talk" });
    expect(again).toMatchObject({ ok: true });
  });

  it("lets the Team end up with no Boards", async () => {
    const team = await newTeam();
    const board = await newBoard(team.id, "Only one");
    expect(await deleteBoardConfirmed(ctx.db, team.id, board.id, "Only one")).toBe("deleted");
    expect(await getBoardById(ctx.db, board.id)).toBeNull();
  });

  it("ignores spaces around the typed name", async () => {
    const team = await newTeam();
    const board = await newBoard(team.id, "Spacey");
    expect(await deleteBoardConfirmed(ctx.db, team.id, board.id, "  Spacey ")).toBe("deleted");
  });

  it.each([
    ["a different case", "board x"],
    ["the slug instead", "board-x"],
    ["an extra letter", "Board xx"],
    ["nothing", ""],
    ["a non-text value", 42],
    ["a missing value", undefined],
  ])("deletes nothing for %s", async (_label, typed) => {
    const team = await newTeam();
    const board = await newBoard(team.id, "Board X", "board-x");
    await fill(team.id, board.id);
    expect(await deleteBoardConfirmed(ctx.db, team.id, board.id, typed)).toBe("wrong_confirmation");
    expect(await getBoardById(ctx.db, board.id)).not.toBeNull();
    expect(await total(ideas)).toBeGreaterThan(0);
  });

  it("answers not_found for another Team's Board, even with the right name, and deletes nothing", async () => {
    const mine = await newTeam();
    const theirs = await newTeam();
    const board = await newBoard(theirs.id, "Theirs");
    expect(await deleteBoardConfirmed(ctx.db, mine.id, board.id, "Theirs")).toBe("not_found");
    expect(await getBoardById(ctx.db, board.id)).not.toBeNull();
  });

  it("answers not_found for an unknown or non-text Board id", async () => {
    const team = await newTeam();
    expect(await deleteBoardConfirmed(ctx.db, team.id, "nope", "x")).toBe("not_found");
    expect(await deleteBoardConfirmed(ctx.db, team.id, undefined, "x")).toBe("not_found");
    expect(await deleteBoardConfirmed(ctx.db, team.id, { id: 1 }, "x")).toBe("not_found");
  });
});
