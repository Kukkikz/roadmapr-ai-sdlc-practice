import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createBoard, createMember, createTag, listTags } from "@/data";
import { teams } from "@/db/schema";
import { createTestDb } from "./helpers/db";

const sessionRef = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sessionRef.current }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));

let ctx: Awaited<ReturnType<typeof createTestDb>>;
vi.mock("@/db", () => ({ getDb: () => ctx.db }));

const { createTagAction, updateTagAction, deleteTagAction } =
  await import("@/components/team/tag-actions");

let counter = 0;
async function setup(role: "owner" | "member" = "member") {
  const n = ++counter;
  const team = { id: `team-${n}`, name: `Team ${n}`, slug: `team-${n}` };
  await ctx.db.insert(teams).values(team);
  const member = await createMember(ctx.db, { teamId: team.id, displayName: `m${n}`, role });
  const board = await createBoard(ctx.db, { teamId: team.id, name: "B", slug: "b" });
  sessionRef.current = { member: { id: member.id, teamId: team.id, role }, team };
  return { team, board };
}
const form = (data: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(data)) body.set(key, value);
  return body;
};

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

describe("tag actions (US-5.2, US-3.6)", () => {
  it("lets a plain Member create, rename, recolour and delete a Tag", async () => {
    const { board } = await setup("member");
    expect(
      await createTagAction(null, form({ boardId: board.id, name: "ui", color: "blue" })),
    ).toEqual({ ok: true });
    const [tag] = await listTags(ctx.db, board.id);
    expect(tag).toMatchObject({ name: "ui", color: "blue" });

    expect(
      await updateTagAction(null, form({ tagId: tag.id, name: "design", color: "green" })),
    ).toEqual({ ok: true });
    expect((await listTags(ctx.db, board.id))[0]).toMatchObject({ name: "design", color: "green" });

    expect(await deleteTagAction(null, form({ tagId: tag.id }))).toEqual({ ok: true });
    expect(await listTags(ctx.db, board.id)).toHaveLength(0);
    expect(revalidate).toHaveBeenCalled();
  });

  it("refuses someone signed out and changes nothing", async () => {
    const { board } = await setup();
    const tag = await createTag(ctx.db, { boardId: board.id, name: "keep", color: "grey" });
    sessionRef.current = null;
    expect(await createTagAction(null, form({ boardId: board.id, name: "x" }))).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await updateTagAction(null, form({ tagId: tag.id, name: "x", color: "red" }))).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await deleteTagAction(null, form({ tagId: tag.id }))).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await listTags(ctx.db, board.id)).toMatchObject([{ name: "keep", color: "grey" }]);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("will not touch another Team's Board or Tag", async () => {
    const theirs = await setup();
    const tag = await createTag(ctx.db, { boardId: theirs.board.id, name: "keep", color: "grey" });
    await setup(); // the signed-in Member now belongs to a different Team
    expect(await createTagAction(null, form({ boardId: theirs.board.id, name: "x" }))).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(await updateTagAction(null, form({ tagId: tag.id, name: "x", color: "red" }))).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(await deleteTagAction(null, form({ tagId: tag.id }))).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(await listTags(ctx.db, theirs.board.id)).toMatchObject([
      { name: "keep", color: "grey" },
    ]);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("returns field errors for a bad name or colour", async () => {
    const { board } = await setup();
    expect(await createTagAction(null, form({ boardId: board.id, name: " " }))).toMatchObject({
      ok: false,
      error: "invalid",
      fieldErrors: { name: expect.any(String) },
    });
    expect(
      await createTagAction(null, form({ boardId: board.id, name: "a", color: "pink" })),
    ).toMatchObject({ ok: false, error: "invalid", fieldErrors: { color: expect.any(String) } });
    expect(await listTags(ctx.db, board.id)).toHaveLength(0);
  });
});
