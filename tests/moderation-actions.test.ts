import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addComment, createBoard, createIdea, createMember, getIdea, listComments } from "@/data";
import { teams } from "@/db/schema";
import { createTestDb } from "./helpers/db";

const sessionRef = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sessionRef.current }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));

let ctx: Awaited<ReturnType<typeof createTestDb>>;
vi.mock("@/db", () => ({ getDb: () => ctx.db }));

const { setCommentHiddenAction, setIdeaHiddenAction } =
  await import("@/components/team/moderation-actions");

let counter = 0;
async function setup(role: "owner" | "member" = "member") {
  const n = ++counter;
  const team = { id: `team-${n}`, name: `Team ${n}`, slug: `team-${n}` };
  await ctx.db.insert(teams).values(team);
  const member = await createMember(ctx.db, { teamId: team.id, displayName: `m${n}`, role });
  const board = await createBoard(ctx.db, { teamId: team.id, name: "B", slug: "b" });
  const idea = await createIdea(ctx.db, { boardId: board.id, title: "Idea", actorId: "anon:a" });
  const comment = await addComment(ctx.db, { ideaId: idea.id, body: "Hi", actorId: "anon:a" });
  sessionRef.current = { member: { id: member.id, teamId: team.id, role }, team };
  return { idea, comment };
}
const form = (fields: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return body;
};
const ideaHidden = async (id: string) =>
  (await getIdea(ctx.db, id, { includeHidden: true }))?.hidden;

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

describe("setIdeaHiddenAction (US-5.3, US-3.6)", () => {
  it("lets a plain Member hide and unhide an Idea", async () => {
    const { idea } = await setup("member");
    expect(await setIdeaHiddenAction(null, form({ ideaId: idea.id, hidden: "true" }))).toEqual({
      ok: true,
    });
    expect(await ideaHidden(idea.id)).toBe(true);
    expect(await setIdeaHiddenAction(null, form({ ideaId: idea.id, hidden: "false" }))).toEqual({
      ok: true,
    });
    expect(await ideaHidden(idea.id)).toBe(false);
    expect(revalidate).toHaveBeenCalled();
  });

  it("refuses someone signed out and changes nothing", async () => {
    const { idea } = await setup();
    sessionRef.current = null;
    expect(await setIdeaHiddenAction(null, form({ ideaId: idea.id, hidden: "true" }))).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await ideaHidden(idea.id)).toBe(false);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("will not touch an Idea on another Team's Board", async () => {
    const theirs = await setup();
    await setup(); // the signed-in Member now belongs to a different Team
    expect(
      await setIdeaHiddenAction(null, form({ ideaId: theirs.idea.id, hidden: "true" })),
    ).toEqual({ ok: false, error: "not-found" });
    expect(await ideaHidden(theirs.idea.id)).toBe(false);
    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe("setCommentHiddenAction (US-5.3, US-3.6)", () => {
  it("lets a Member hide and unhide a Comment", async () => {
    const { idea, comment } = await setup();
    expect(
      await setCommentHiddenAction(null, form({ commentId: comment.id, hidden: "true" })),
    ).toEqual({ ok: true });
    expect(await listComments(ctx.db, idea.id)).toHaveLength(0);
    expect(
      await setCommentHiddenAction(null, form({ commentId: comment.id, hidden: "false" })),
    ).toEqual({ ok: true });
    expect(await listComments(ctx.db, idea.id)).toHaveLength(1);
  });

  it("refuses someone signed out, and another Team's Comment", async () => {
    const theirs = await setup();
    sessionRef.current = null;
    expect(
      await setCommentHiddenAction(null, form({ commentId: theirs.comment.id, hidden: "true" })),
    ).toEqual({ ok: false, error: "forbidden" });
    await setup();
    expect(
      await setCommentHiddenAction(null, form({ commentId: theirs.comment.id, hidden: "true" })),
    ).toEqual({ ok: false, error: "not-found" });
    expect(await listComments(ctx.db, theirs.idea.id)).toHaveLength(1);
  });
});

describe("a malformed hidden value (fails closed)", () => {
  it("never unhides on a missing or garbled value", async () => {
    const { idea } = await setup();
    await setIdeaHiddenAction(null, form({ ideaId: idea.id, hidden: "true" }));
    const bad: Record<string, string>[] = [{ ideaId: idea.id }, { ideaId: idea.id, hidden: "yes" }];
    for (const fields of bad) {
      expect(await setIdeaHiddenAction(null, form(fields))).toEqual({
        ok: false,
        error: "invalid",
      });
    }
    expect(await ideaHidden(idea.id)).toBe(true);
  });
});
