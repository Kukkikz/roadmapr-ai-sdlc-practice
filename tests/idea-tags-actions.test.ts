import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createBoard, createIdea, createMember, createTag, getIdea } from "@/data";
import { teams } from "@/db/schema";
import { createTestDb } from "./helpers/db";

const sessionRef = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sessionRef.current }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));

let ctx: Awaited<ReturnType<typeof createTestDb>>;
vi.mock("@/db", () => ({ getDb: () => ctx.db }));

const { setIdeaTagsAction } = await import("@/components/team/idea-tags-actions");

let counter = 0;
async function setup(role: "owner" | "member" = "member") {
  const n = ++counter;
  const team = { id: `team-${n}`, name: `Team ${n}`, slug: `team-${n}` };
  await ctx.db.insert(teams).values(team);
  const member = await createMember(ctx.db, { teamId: team.id, displayName: `m${n}`, role });
  const board = await createBoard(ctx.db, { teamId: team.id, name: "B", slug: "b" });
  const idea = await createIdea(ctx.db, { boardId: board.id, title: "Idea", actorId: "anon:a" });
  const tag = await createTag(ctx.db, { boardId: board.id, name: "ui", color: "blue" });
  sessionRef.current = { member: { id: member.id, teamId: team.id, role }, team };
  return { idea, tag };
}
const form = (ideaId: string | undefined, tagIds: string[]) => {
  const body = new FormData();
  if (ideaId) body.set("ideaId", ideaId);
  for (const id of tagIds) body.append("tagId", id);
  return body;
};
const tagsOf = async (ideaId: string) => (await getIdea(ctx.db, ideaId))?.tags ?? [];

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(() => {
  sessionRef.current = null;
  revalidate.mockClear();
});

describe("setIdeaTagsAction (US-5.2, US-3.6)", () => {
  it("lets a plain Member apply and remove Tags", async () => {
    const { idea, tag } = await setup("member");
    expect(await setIdeaTagsAction(null, form(idea.id, [tag.id]))).toEqual({ ok: true });
    expect(await tagsOf(idea.id)).toHaveLength(1);
    expect(await setIdeaTagsAction(null, form(idea.id, []))).toEqual({ ok: true });
    expect(await tagsOf(idea.id)).toHaveLength(0);
    expect(revalidate).toHaveBeenCalled();
  });

  it("refuses someone signed out and changes nothing", async () => {
    const { idea, tag } = await setup();
    sessionRef.current = null;
    expect(await setIdeaTagsAction(null, form(idea.id, [tag.id]))).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await tagsOf(idea.id)).toHaveLength(0);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("will not touch an Idea on another Team's Board", async () => {
    const theirs = await setup();
    await setup(); // the signed-in Member now belongs to a different Team
    expect(await setIdeaTagsAction(null, form(theirs.idea.id, [theirs.tag.id]))).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(await tagsOf(theirs.idea.id)).toHaveLength(0);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("rejects a Tag from another Board and a missing Idea id", async () => {
    const { idea } = await setup();
    const other = await setup();
    sessionRef.current = null;
    await setup(); // fresh Member session for a third Team
    expect(await setIdeaTagsAction(null, form(idea.id, [other.tag.id]))).toEqual({
      ok: false,
      error: "not-found",
    });
    const mine = await setup();
    expect(await setIdeaTagsAction(null, form(mine.idea.id, [other.tag.id]))).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(await setIdeaTagsAction(null, form(undefined, []))).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(await tagsOf(mine.idea.id)).toHaveLength(0);
  });
});
