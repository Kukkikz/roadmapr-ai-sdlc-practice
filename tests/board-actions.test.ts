import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMember, getBoardBySlugs, listBoardsForTeam } from "@/data";
import { teams } from "@/db/schema";
import { createTestDb } from "./helpers/db";

const sessionRef = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sessionRef.current }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));

let ctx: Awaited<ReturnType<typeof createTestDb>>;
vi.mock("@/db", () => ({ getDb: () => ctx.db }));

const { createBoardAction } = await import("@/components/team/board-actions");

type Who = { id: string; teamId: string; role: "owner" | "member" };
let counter = 0;

async function newTeam() {
  const n = ++counter;
  const team = { id: `team-${n}`, name: `Team ${n}`, slug: `team-${n}` };
  await ctx.db.insert(teams).values(team);
  return team;
}
async function join(teamId: string, role: "owner" | "member") {
  const row = await createMember(ctx.db, { teamId, displayName: `m${++counter}`, role });
  return { id: row.id, teamId, role } satisfies Who;
}
const sessionOf = (who: Who, team: { id: string; slug: string }) => ({ member: who, team });
const form = (data: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(data)) body.set(key, value);
  return body;
};
const count = async (teamId: string) => (await listBoardsForTeam(ctx.db, teamId)).length;

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

describe("createBoardAction (US-4.1, US-3.6)", () => {
  it("lets an Owner create a Board in their own Team", async () => {
    const team = await newTeam();
    const owner = await join(team.id, "owner");
    sessionRef.current = sessionOf(owner, team);
    const result = await createBoardAction(null, form({ name: "Bugs", slug: "bugs" }));
    expect(result).toEqual({ ok: true, boardName: "Bugs" });
    expect((await getBoardBySlugs(ctx.db, team.slug, "bugs"))?.board.teamId).toBe(team.id);
    expect(revalidate).toHaveBeenCalledWith("/dashboard");
  });

  it("refuses a plain Member and creates nothing", async () => {
    const team = await newTeam();
    await join(team.id, "owner");
    const bo = await join(team.id, "member");
    sessionRef.current = sessionOf(bo, team);
    expect(await createBoardAction(null, form({ name: "Bugs", slug: "bugs" }))).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await count(team.id)).toBe(0);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("refuses someone signed out", async () => {
    const team = await newTeam();
    expect(await createBoardAction(null, form({ name: "Bugs", slug: "bugs" }))).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await count(team.id)).toBe(0);
  });

  it("creates the Board in the Session's Team only: a teamId field is ignored", async () => {
    const mine = await newTeam();
    const theirs = await newTeam();
    const me = await join(mine.id, "owner");
    sessionRef.current = sessionOf(me, mine);
    await createBoardAction(null, form({ name: "Bugs", slug: "bugs", teamId: theirs.id }));
    expect(await count(mine.id)).toBe(1);
    expect(await count(theirs.id)).toBe(0);
  });

  it("refuses a Session whose Member and Team disagree", async () => {
    const a = await newTeam();
    const b = await newTeam();
    const ada = await join(a.id, "owner");
    sessionRef.current = sessionOf(ada, b);
    expect(await createBoardAction(null, form({ name: "Bugs", slug: "bugs" }))).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await count(a.id)).toBe(0);
    expect(await count(b.id)).toBe(0);
  });

  it("returns field errors for a taken or reserved slug", async () => {
    const team = await newTeam();
    const owner = await join(team.id, "owner");
    sessionRef.current = sessionOf(owner, team);
    await createBoardAction(null, form({ name: "Bugs", slug: "bugs" }));
    const taken = await createBoardAction(null, form({ name: "More bugs", slug: "bugs" }));
    expect(taken).toMatchObject({ ok: false, error: "invalid" });
    const reserved = await createBoardAction(null, form({ name: "Plan", slug: "roadmap" }));
    expect(reserved).toMatchObject({ ok: false, error: "invalid" });
    expect(await count(team.id)).toBe(1);
  });

  it("handles a missing or file-typed field without error", async () => {
    const team = await newTeam();
    const owner = await join(team.id, "owner");
    sessionRef.current = sessionOf(owner, team);
    expect(await createBoardAction(null, form({}))).toMatchObject({ ok: false, error: "invalid" });
    const body = new FormData();
    body.set("name", new File(["x"], "x.txt"));
    body.set("slug", "files");
    expect(await createBoardAction(null, body)).toMatchObject({ ok: false, error: "invalid" });
    expect(await count(team.id)).toBe(0);
  });
});
