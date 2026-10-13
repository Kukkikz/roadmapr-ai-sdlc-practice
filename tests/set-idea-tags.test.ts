import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBoard, createIdea, createTag, getIdea, setIdeaHidden } from "@/data";
import { teams } from "@/db/schema";
import { setIdeaTags } from "@/lib/set-idea-tags";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

async function setup() {
  const n = ++counter;
  const team = { id: `team-${n}`, name: `Team ${n}`, slug: `team-${n}` };
  await ctx.db.insert(teams).values(team);
  const board = await createBoard(ctx.db, { teamId: team.id, name: "B", slug: "b" });
  const idea = await createIdea(ctx.db, { boardId: board.id, title: "Idea", actorId: "anon:a" });
  const ui = await createTag(ctx.db, { boardId: board.id, name: "ui", color: "blue" });
  const api = await createTag(ctx.db, { boardId: board.id, name: "api", color: "green" });
  return { team, board, idea, ui, api };
}
const tagNames = async (ideaId: string) =>
  ((await getIdea(ctx.db, ideaId, { includeHidden: true }))?.tags ?? []).map((t) => t.name).sort();

describe("setIdeaTags (US-5.2)", () => {
  it("applies the ticked Tags and takes the unticked ones off", async () => {
    const { team, idea, ui, api } = await setup();
    expect(await setIdeaTags(ctx.db, team.id, idea.id, [ui.id, api.id])).toBe("saved");
    expect(await tagNames(idea.id)).toEqual(["api", "ui"]);
    expect(await setIdeaTags(ctx.db, team.id, idea.id, [api.id])).toBe("saved");
    expect(await tagNames(idea.id)).toEqual(["api"]);
    expect(await setIdeaTags(ctx.db, team.id, idea.id, [])).toBe("saved");
    expect(await tagNames(idea.id)).toEqual([]);
  });

  it("saving the same set, or a repeated id, changes nothing and does not fail", async () => {
    const { team, idea, ui } = await setup();
    await setIdeaTags(ctx.db, team.id, idea.id, [ui.id]);
    expect(await setIdeaTags(ctx.db, team.id, idea.id, [ui.id, ui.id])).toBe("saved");
    expect(await tagNames(idea.id)).toEqual(["ui"]);
  });

  it("refuses a Tag of another Board and changes nothing", async () => {
    const { team, idea, ui } = await setup();
    const other = await createBoard(ctx.db, { teamId: team.id, name: "C", slug: "c" });
    const foreign = await createTag(ctx.db, { boardId: other.id, name: "foreign", color: "red" });
    await setIdeaTags(ctx.db, team.id, idea.id, [ui.id]);
    expect(await setIdeaTags(ctx.db, team.id, idea.id, [foreign.id])).toBe("invalid");
    expect(await setIdeaTags(ctx.db, team.id, idea.id, [ui.id, "no-such-tag"])).toBe("invalid");
    expect(await tagNames(idea.id)).toEqual(["ui"]);
  });

  it("rejects anything that is not a list of ids", async () => {
    const { team, idea } = await setup();
    for (const bad of [undefined, "ui", [1], [null], { 0: "x" }]) {
      expect(await setIdeaTags(ctx.db, team.id, idea.id, bad)).toBe("invalid");
    }
  });

  it("answers not_found for another Team's Idea, a bad id, and touches nothing", async () => {
    const mine = await setup();
    const theirs = await setup();
    expect(await setIdeaTags(ctx.db, mine.team.id, theirs.idea.id, [theirs.ui.id])).toBe(
      "not_found",
    );
    expect(await setIdeaTags(ctx.db, mine.team.id, undefined, [])).toBe("not_found");
    expect(await setIdeaTags(ctx.db, mine.team.id, "nope", [])).toBe("not_found");
    expect(await tagNames(theirs.idea.id)).toEqual([]);
  });

  it("works on a hidden Idea, since Members moderate", async () => {
    const { team, idea, ui } = await setup();
    await setIdeaHidden(ctx.db, idea.id, true);
    expect(await setIdeaTags(ctx.db, team.id, idea.id, [ui.id])).toBe("saved");
    expect(await tagNames(idea.id)).toEqual(["ui"]);
  });
});
