import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assignTag, createBoard, createIdea, createTag, getIdea, listTags } from "@/data";
import { teams } from "@/db/schema";
import { TAG_COLORS } from "@/lib/tag-colors";
import { createBoardTag, deleteBoardTag, updateBoardTag } from "@/lib/manage-tags";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

async function newBoard() {
  const n = ++counter;
  const team = { id: `team-${n}`, name: `Team ${n}`, slug: `team-${n}` };
  await ctx.db.insert(teams).values(team);
  const board = await createBoard(ctx.db, { teamId: team.id, name: "B", slug: "b" });
  return { team, board };
}

describe("createBoardTag (US-5.2)", () => {
  it("creates a Tag with the chosen colour, trimming the name", async () => {
    const { team, board } = await newBoard();
    const result = await createBoardTag(ctx.db, team.id, board.id, {
      name: "  billing ",
      color: "blue",
    });
    expect(result).toMatchObject({ ok: true, tag: { name: "billing", color: "blue" } });
    expect(await listTags(ctx.db, board.id)).toHaveLength(1);
  });

  it("makes a new Tag grey when no colour is given", async () => {
    const { team, board } = await newBoard();
    const result = await createBoardTag(ctx.db, team.id, board.id, { name: "ux" });
    expect(result).toMatchObject({ ok: true, tag: { color: "grey" } });
  });

  it("accepts every colour in the palette and nothing else", async () => {
    const { team, board } = await newBoard();
    for (const color of TAG_COLORS) {
      const ok = await createBoardTag(ctx.db, team.id, board.id, { name: `t-${color}`, color });
      expect(ok.ok).toBe(true);
    }
    const bad = await createBoardTag(ctx.db, team.id, board.id, { name: "x", color: "#ff0000" });
    expect(bad).toMatchObject({
      ok: false,
      error: "invalid",
      fieldErrors: { color: expect.any(String) },
    });
    expect(await listTags(ctx.db, board.id)).toHaveLength(TAG_COLORS.length);
  });

  it("rejects an empty, blank or over-long name", async () => {
    const { team, board } = await newBoard();
    for (const name of ["", "   ", "x".repeat(31), undefined, 5]) {
      const result = await createBoardTag(ctx.db, team.id, board.id, { name, color: "red" });
      expect(result).toMatchObject({
        ok: false,
        error: "invalid",
        fieldErrors: { name: expect.any(String) },
      });
    }
    expect(await listTags(ctx.db, board.id)).toHaveLength(0);
  });

  it("refuses a name already used on the Board, ignoring case, but allows it on another Board", async () => {
    const { team, board } = await newBoard();
    await createBoardTag(ctx.db, team.id, board.id, { name: "UI", color: "blue" });
    const dup = await createBoardTag(ctx.db, team.id, board.id, { name: "ui", color: "red" });
    expect(dup).toMatchObject({
      ok: false,
      error: "invalid",
      fieldErrors: { name: expect.any(String) },
    });
    const other = await createBoard(ctx.db, { teamId: team.id, name: "C", slug: "c" });
    expect((await createBoardTag(ctx.db, team.id, other.id, { name: "ui" })).ok).toBe(true);
  });

  it("answers not-found for another Team's Board, or a bad id, and creates nothing", async () => {
    const mine = await newBoard();
    const theirs = await newBoard();
    expect(
      await createBoardTag(ctx.db, mine.team.id, theirs.board.id, { name: "x", color: "red" }),
    ).toEqual({ ok: false, error: "not-found" });
    expect(await createBoardTag(ctx.db, mine.team.id, undefined, { name: "x" })).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(await listTags(ctx.db, theirs.board.id)).toHaveLength(0);
  });
});

describe("updateBoardTag (US-5.2)", () => {
  it("renames and recolours", async () => {
    const { team, board } = await newBoard();
    const tag = await createTag(ctx.db, { boardId: board.id, name: "old", color: "grey" });
    const result = await updateBoardTag(ctx.db, team.id, tag.id, { name: "new", color: "green" });
    expect(result).toMatchObject({ ok: true, tag: { id: tag.id, name: "new", color: "green" } });
  });

  it("lets a Tag keep its own name when only the colour or the case changes", async () => {
    const { team, board } = await newBoard();
    const tag = await createTag(ctx.db, { boardId: board.id, name: "api", color: "grey" });
    const result = await updateBoardTag(ctx.db, team.id, tag.id, { name: "API", color: "red" });
    expect(result).toMatchObject({ ok: true, tag: { name: "API", color: "red" } });
  });

  it("refuses a name another Tag on the Board already has and changes nothing", async () => {
    const { team, board } = await newBoard();
    await createTag(ctx.db, { boardId: board.id, name: "ui", color: "grey" });
    const tag = await createTag(ctx.db, { boardId: board.id, name: "api", color: "grey" });
    const result = await updateBoardTag(ctx.db, team.id, tag.id, { name: "UI", color: "red" });
    expect(result).toMatchObject({
      ok: false,
      error: "invalid",
      fieldErrors: { name: expect.any(String) },
    });
    expect((await listTags(ctx.db, board.id)).map((t) => [t.name, t.color])).toEqual([
      ["api", "grey"],
      ["ui", "grey"],
    ]);
  });

  it("will not touch another Team's Tag", async () => {
    const mine = await newBoard();
    const theirs = await newBoard();
    const tag = await createTag(ctx.db, { boardId: theirs.board.id, name: "keep", color: "grey" });
    expect(await updateBoardTag(ctx.db, mine.team.id, tag.id, { name: "x", color: "red" })).toEqual(
      { ok: false, error: "not-found" },
    );
    expect(await updateBoardTag(ctx.db, mine.team.id, undefined, { name: "x" })).toEqual({
      ok: false,
      error: "not-found",
    });
    expect((await listTags(ctx.db, theirs.board.id))[0]).toMatchObject({
      name: "keep",
      color: "grey",
    });
  });
});

describe("deleteBoardTag (US-5.2)", () => {
  it("deletes the Tag and takes it off its Ideas, which stay", async () => {
    const { team, board } = await newBoard();
    const tag = await createTag(ctx.db, { boardId: board.id, name: "bug", color: "red" });
    const idea = await createIdea(ctx.db, { boardId: board.id, title: "I", actorId: "anon:a" });
    await assignTag(ctx.db, idea.id, tag.id);
    expect(await deleteBoardTag(ctx.db, team.id, tag.id)).toBe("deleted");
    expect(await listTags(ctx.db, board.id)).toHaveLength(0);
    expect((await getIdea(ctx.db, idea.id))?.tags).toEqual([]);
  });

  it("will not delete another Team's Tag", async () => {
    const mine = await newBoard();
    const theirs = await newBoard();
    const tag = await createTag(ctx.db, { boardId: theirs.board.id, name: "keep", color: "grey" });
    expect(await deleteBoardTag(ctx.db, mine.team.id, tag.id)).toBe("not_found");
    expect(await deleteBoardTag(ctx.db, mine.team.id, 42)).toBe("not_found");
    expect(await listTags(ctx.db, theirs.board.id)).toHaveLength(1);
  });
});
