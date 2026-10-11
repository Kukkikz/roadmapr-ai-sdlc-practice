import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBoard, createIdea, getBoardBySlugs, getIdea } from "@/data";
import { teams } from "@/db/schema";
import { editBoardForTeam } from "@/lib/edit-board";
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
const newBoard = (teamId: string, slug: string) =>
  createBoard(ctx.db, { teamId, name: slug, slug, description: "old" });

describe("editBoardForTeam (US-4.1)", () => {
  it("changes name, slug and description, and moves the URL", async () => {
    const team = await newTeam();
    const board = await newBoard(team.id, "old-slug");
    const result = await editBoardForTeam(ctx.db, team, board.id, {
      visibility: "public",
      name: "  New name ",
      slug: "new-slug",
      description: " New text ",
    });
    expect(result).toEqual({ ok: true, boardSlug: "new-slug", boardName: "New name" });
    expect(await getBoardBySlugs(ctx.db, team.slug, "old-slug")).toBeNull();
    expect((await getBoardBySlugs(ctx.db, team.slug, "new-slug"))?.board).toMatchObject({
      id: board.id,
      name: "New name",
      description: "New text",
      visibility: "public",
    });
  });

  it("lets a Board keep its own slug and clears an empty description", async () => {
    const team = await newTeam();
    const board = await newBoard(team.id, "same");
    const result = await editBoardForTeam(ctx.db, team, board.id, {
      visibility: "public",
      name: "Renamed",
      slug: "same",
      description: "  ",
    });
    expect(result).toMatchObject({ ok: true });
    const found = await getBoardBySlugs(ctx.db, team.slug, "same");
    expect(found?.board.name).toBe("Renamed");
    expect(found?.board.description ?? null).toBeNull();
  });

  it("switches the visibility both ways and keeps the Ideas", async () => {
    const team = await newTeam();
    const board = await newBoard(team.id, "switchy");
    const idea = await createIdea(ctx.db, {
      boardId: board.id,
      title: "Keep me",
      actorId: "anon:a",
    });
    const make = (visibility: string) =>
      editBoardForTeam(ctx.db, team, board.id, { name: "Switchy", slug: "switchy", visibility });
    expect(await make("private")).toMatchObject({ ok: true });
    expect((await getBoardBySlugs(ctx.db, team.slug, "switchy"))?.board.visibility).toBe("private");
    expect(await make("public")).toMatchObject({ ok: true });
    expect((await getBoardBySlugs(ctx.db, team.slug, "switchy"))?.board.visibility).toBe("public");
    expect((await getIdea(ctx.db, idea.id))?.title).toBe("Keep me");
  });

  it("refuses a request without a visibility instead of publishing the Board, and an unknown one", async () => {
    const team = await newTeam();
    const board = await newBoard(team.id, "plain");
    await editBoardForTeam(ctx.db, team, board.id, {
      name: "N",
      slug: "plain",
      visibility: "private",
    });
    const missing = await editBoardForTeam(ctx.db, team, board.id, { name: "N2", slug: "plain" });
    expect(missing).toMatchObject({ ok: false, error: "invalid" });
    expect((await getBoardBySlugs(ctx.db, team.slug, "plain"))?.board).toMatchObject({
      name: "N",
      visibility: "private",
    });
    const bad = await editBoardForTeam(ctx.db, team, board.id, {
      name: "N1",
      slug: "plain",
      visibility: "secret",
    });
    expect(bad).toMatchObject({ ok: false, error: "invalid" });
  });

  it("says a slug used by another Board of the Team is taken, and changes nothing", async () => {
    const team = await newTeam();
    await newBoard(team.id, "taken");
    const board = await newBoard(team.id, "mine");
    const result = await editBoardForTeam(ctx.db, team, board.id, {
      visibility: "public",
      name: "N",
      slug: "taken",
    });
    expect(result).toMatchObject({ ok: false, error: "invalid" });
    if (result.ok || result.error !== "invalid") throw new Error("expected invalid");
    expect(result.fieldErrors.slug).toMatch(/taken/);
    expect((await getBoardBySlugs(ctx.db, team.slug, "mine"))?.board.name).toBe("mine");
  });

  it("allows a slug that another Team uses", async () => {
    const a = await newTeam();
    const b = await newTeam();
    await newBoard(a.id, "shared");
    const board = await newBoard(b.id, "other");
    const result = await editBoardForTeam(ctx.db, b, board.id, {
      visibility: "public",
      name: "N",
      slug: "shared",
    });
    expect(result).toMatchObject({ ok: true });
  });

  it("answers not-found for a Board of another Team and leaves it untouched", async () => {
    const mine = await newTeam();
    const theirs = await newTeam();
    const board = await newBoard(theirs.id, "theirs");
    const result = await editBoardForTeam(ctx.db, mine, board.id, {
      visibility: "public",
      name: "Hacked",
      slug: "hacked",
    });
    expect(result).toEqual({ ok: false, error: "not-found" });
    expect((await getBoardBySlugs(ctx.db, theirs.slug, "theirs"))?.board.name).toBe("theirs");
  });

  it("answers not-found for an unknown Board id", async () => {
    const team = await newTeam();
    expect(
      await editBoardForTeam(ctx.db, team, "nope", {
        visibility: "public",
        name: "N",
        slug: "fine",
      }),
    ).toEqual({
      ok: false,
      error: "not-found",
    });
  });

  it.each([
    ["an empty name", { name: "", slug: "ok-slug" }, "name"],
    ["a reserved slug", { name: "Ok", slug: "roadmap" }, "slug"],
    [
      "a description over 300 characters",
      { name: "Ok", slug: "ok-slug", description: "d".repeat(301) },
      "description",
    ],
  ])("rejects %s and changes nothing", async (_label, input, field) => {
    const team = await newTeam();
    const board = await newBoard(team.id, "untouched");
    const result = await editBoardForTeam(ctx.db, team, board.id, {
      visibility: "public",
      ...input,
    });
    expect(result).toMatchObject({ ok: false, error: "invalid" });
    if (result.ok || result.error !== "invalid") throw new Error("expected invalid");
    expect(result.fieldErrors[field as keyof typeof result.fieldErrors]).toBeTruthy();
    expect((await getBoardBySlugs(ctx.db, team.slug, "untouched"))?.board.description).toBe("old");
  });
});
