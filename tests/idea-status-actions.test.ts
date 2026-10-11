import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createBoard, createIdea, createMember, getIdea, listStatusEvents } from "@/data";
import { teams } from "@/db/schema";
import { createTestDb } from "./helpers/db";

const sessionRef = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sessionRef.current }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));

let ctx: Awaited<ReturnType<typeof createTestDb>>;
vi.mock("@/db", () => ({ getDb: () => ctx.db }));

const { changeStatusAction } = await import("@/components/team/idea-status-actions");

let counter = 0;
async function setup(role: "owner" | "member" = "member") {
  const n = ++counter;
  const team = { id: `team-${n}`, name: `Team ${n}`, slug: `team-${n}` };
  await ctx.db.insert(teams).values(team);
  const member = await createMember(ctx.db, { teamId: team.id, displayName: `m${n}`, role });
  const board = await createBoard(ctx.db, { teamId: team.id, name: "B", slug: "b" });
  const idea = await createIdea(ctx.db, { boardId: board.id, title: "Idea", actorId: "anon:a" });
  sessionRef.current = { member: { id: member.id, teamId: team.id, role }, team };
  return { team, member, idea };
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

describe("changeStatusAction (US-5.1, US-3.6)", () => {
  it("lets a plain Member change the status and records them as the actor", async () => {
    const { member, idea } = await setup("member");
    expect(await changeStatusAction(null, form({ ideaId: idea.id, status: "shipped" }))).toEqual({
      ok: true,
    });
    expect((await getIdea(ctx.db, idea.id))?.status).toBe("shipped");
    expect((await listStatusEvents(ctx.db, idea.id))[0]).toMatchObject({
      actorId: `member:${member.id}`,
      fromStatus: "open",
      toStatus: "shipped",
    });
    expect(revalidate).toHaveBeenCalled();
  });

  it("refuses someone signed out and changes nothing", async () => {
    const { idea } = await setup();
    sessionRef.current = null;
    expect(await changeStatusAction(null, form({ ideaId: idea.id, status: "planned" }))).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect((await getIdea(ctx.db, idea.id))?.status).toBe("open");
    expect(await listStatusEvents(ctx.db, idea.id)).toHaveLength(0);
  });

  it("will not touch an Idea on another Team's Board", async () => {
    const { idea } = await setup();
    await setup(); // the signed-in Member now belongs to a different Team
    expect(await changeStatusAction(null, form({ ideaId: idea.id, status: "planned" }))).toEqual({
      ok: false,
      error: "not-found",
    });
    expect((await getIdea(ctx.db, idea.id))?.status).toBe("open");
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("rejects an unknown status and a missing Idea id", async () => {
    const { idea } = await setup();
    expect(await changeStatusAction(null, form({ ideaId: idea.id, status: "done" }))).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(await changeStatusAction(null, form({ status: "planned" }))).toEqual({
      ok: false,
      error: "not-found",
    });
    expect((await getIdea(ctx.db, idea.id))?.status).toBe("open");
  });
});
