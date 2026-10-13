import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addComment, createBoard, createIdea, getIdea, listComments } from "@/data";
import { teams } from "@/db/schema";
import { moderateComment, moderateIdea } from "@/lib/moderate";
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
  const comment = await addComment(ctx.db, { ideaId: idea.id, body: "Hi", actorId: "anon:a" });
  return { team, idea, comment };
}
const ideaHidden = async (id: string) =>
  (await getIdea(ctx.db, id, { includeHidden: true }))?.hidden;
const commentHidden = async (ideaId: string, id: string) =>
  (await listComments(ctx.db, ideaId, { includeHidden: true })).find((c) => c.id === id)?.hidden;

describe("moderateIdea (US-5.3, G2)", () => {
  it("hides an Idea from the public and unhides it, keeping the row", async () => {
    const { team, idea } = await setup();
    expect(await moderateIdea(ctx.db, team.id, idea.id, true)).toBe("changed");
    expect(await getIdea(ctx.db, idea.id)).toBeNull();
    expect(await ideaHidden(idea.id)).toBe(true);
    expect(await moderateIdea(ctx.db, team.id, idea.id, false)).toBe("changed");
    expect(await getIdea(ctx.db, idea.id)).not.toBeNull();
  });

  it("reports no change when the Idea is already in that state", async () => {
    const { team, idea } = await setup();
    expect(await moderateIdea(ctx.db, team.id, idea.id, false)).toBe("unchanged");
    await moderateIdea(ctx.db, team.id, idea.id, true);
    expect(await moderateIdea(ctx.db, team.id, idea.id, true)).toBe("unchanged");
  });

  it("answers not_found for another Team's Idea, a bad id, and changes nothing", async () => {
    const mine = await setup();
    const theirs = await setup();
    expect(await moderateIdea(ctx.db, mine.team.id, theirs.idea.id, true)).toBe("not_found");
    expect(await moderateIdea(ctx.db, mine.team.id, undefined, true)).toBe("not_found");
    expect(await moderateIdea(ctx.db, mine.team.id, "nope", true)).toBe("not_found");
    expect(await ideaHidden(theirs.idea.id)).toBe(false);
  });
});

describe("moderateComment (US-5.3, G2)", () => {
  it("hides a Comment from the public and unhides it", async () => {
    const { team, idea, comment } = await setup();
    expect(await moderateComment(ctx.db, team.id, comment.id, true)).toBe("changed");
    expect(await listComments(ctx.db, idea.id)).toHaveLength(0);
    expect(await commentHidden(idea.id, comment.id)).toBe(true);
    expect(await moderateComment(ctx.db, team.id, comment.id, true)).toBe("unchanged");
    expect(await moderateComment(ctx.db, team.id, comment.id, false)).toBe("changed");
    expect(await listComments(ctx.db, idea.id)).toHaveLength(1);
  });

  it("works on a Comment of a hidden Idea", async () => {
    const { team, idea, comment } = await setup();
    await moderateIdea(ctx.db, team.id, idea.id, true);
    expect(await moderateComment(ctx.db, team.id, comment.id, true)).toBe("changed");
  });

  it("answers not_found for another Team's Comment, a bad id, and changes nothing", async () => {
    const mine = await setup();
    const theirs = await setup();
    expect(await moderateComment(ctx.db, mine.team.id, theirs.comment.id, true)).toBe("not_found");
    expect(await moderateComment(ctx.db, mine.team.id, undefined, true)).toBe("not_found");
    expect(await moderateComment(ctx.db, mine.team.id, "nope", true)).toBe("not_found");
    expect(await commentHidden(theirs.idea.id, theirs.comment.id)).toBe(false);
  });
});
