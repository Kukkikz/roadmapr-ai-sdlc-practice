import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBoardBySlugs, listBoardsForTeam } from "@/data";
import { teams } from "@/db/schema";
import { createBoardForTeam } from "@/lib/create-board";
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

describe("createBoardForTeam (US-4.1)", () => {
  it("creates a Public Board in the Team with the given name, slug and description", async () => {
    const team = await newTeam();
    const result = await createBoardForTeam(ctx.db, team, {
      name: "  Feature requests ",
      slug: "feature-requests",
      description: "  What should we build next?  ",
    });
    expect(result).toEqual({
      ok: true,
      boardSlug: "feature-requests",
      boardName: "Feature requests",
    });

    const found = await getBoardBySlugs(ctx.db, team.slug, "feature-requests");
    expect(found?.board).toMatchObject({
      teamId: team.id,
      name: "Feature requests",
      description: "What should we build next?",
      visibility: "public",
    });
  });

  it("leaves the description empty when none is given", async () => {
    const team = await newTeam();
    await createBoardForTeam(ctx.db, team, { name: "Bugs", slug: "bugs", description: "   " });
    const found = await getBoardBySlugs(ctx.db, team.slug, "bugs");
    expect(found?.board.description ?? null).toBeNull();
  });

  it("always makes a Public Board, whatever the request says", async () => {
    const team = await newTeam();
    await createBoardForTeam(ctx.db, team, {
      name: "Sneaky",
      slug: "sneaky",
      visibility: "private",
      teamId: "someone-else",
    });
    const found = await getBoardBySlugs(ctx.db, team.slug, "sneaky");
    expect(found?.board).toMatchObject({ visibility: "public", teamId: team.id });
  });

  it("says a taken slug is taken, within the same Team, and creates nothing", async () => {
    const team = await newTeam();
    await createBoardForTeam(ctx.db, team, { name: "One", slug: "ideas-board" });
    const before = (await listBoardsForTeam(ctx.db, team.id)).length;
    const again = await createBoardForTeam(ctx.db, team, { name: "Two", slug: "ideas-board" });
    expect(again).toMatchObject({ ok: false, error: "invalid" });
    if (again.ok || again.error !== "invalid") throw new Error("expected invalid");
    expect(again.fieldErrors.slug).toMatch(/taken/);
    expect((await listBoardsForTeam(ctx.db, team.id)).length).toBe(before);
  });

  it("lets two Teams use the same Board slug", async () => {
    const a = await newTeam();
    const b = await newTeam();
    expect(await createBoardForTeam(ctx.db, a, { name: "Ideas", slug: "wishes" })).toMatchObject({
      ok: true,
    });
    expect(await createBoardForTeam(ctx.db, b, { name: "Ideas", slug: "wishes" })).toMatchObject({
      ok: true,
    });
  });

  it.each([
    ["an empty name", { name: "", slug: "ok-slug" }, "name"],
    ["a blank name", { name: "   ", slug: "ok-slug" }, "name"],
    ["a name over 60 characters", { name: "x".repeat(61), slug: "ok-slug" }, "name"],
    ["a missing name", { slug: "ok-slug" }, "name"],
    ["a reserved slug", { name: "Ok", slug: "roadmap" }, "slug"],
    ["another reserved slug", { name: "Ok", slug: "ideas" }, "slug"],
    ["an uppercase slug", { name: "Ok", slug: "Bugs" }, "slug"],
    ["a slug with spaces", { name: "Ok", slug: "my board" }, "slug"],
    ["a slug with a slash", { name: "Ok", slug: "a/b" }, "slug"],
    ["a one-letter slug", { name: "Ok", slug: "a" }, "slug"],
    ["a missing slug", { name: "Ok" }, "slug"],
    [
      "a description over 300 characters",
      { name: "Ok", slug: "ok-slug", description: "d".repeat(301) },
      "description",
    ],
  ])("rejects %s and creates nothing", async (_label, input, field) => {
    const team = await newTeam();
    const result = await createBoardForTeam(ctx.db, team, input);
    expect(result).toMatchObject({ ok: false, error: "invalid" });
    if (result.ok || result.error !== "invalid") throw new Error("expected invalid");
    expect(result.fieldErrors[field as keyof typeof result.fieldErrors]).toBeTruthy();
    expect(await listBoardsForTeam(ctx.db, team.id)).toEqual([]);
  });

  it("rejects values that are not text", async () => {
    const team = await newTeam();
    const result = await createBoardForTeam(ctx.db, team, { name: 7, slug: { x: 1 } });
    expect(result).toMatchObject({ ok: false, error: "invalid" });
  });
});
