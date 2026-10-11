import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBoard,
  createMember,
  findActiveBoardShareLink,
  getBoardBySlugs,
  listBoardsForTeam,
} from "@/data";
import { eq } from "drizzle-orm";
import { boards, teams } from "@/db/schema";
import { createTestDb } from "./helpers/db";

const sessionRef = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sessionRef.current }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));

let ctx: Awaited<ReturnType<typeof createTestDb>>;
vi.mock("@/db", () => ({ getDb: () => ctx.db }));

const { createBoardAction, editBoardAction, rotateShareLinkAction } =
  await import("@/components/team/board-actions");

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

describe("editBoardAction (US-4.1, US-3.6)", () => {
  async function setup(role: "owner" | "member") {
    const team = await newTeam();
    const board = await createBoard(ctx.db, { teamId: team.id, name: "Bugs", slug: "bugs" });
    const who = await join(team.id, role);
    sessionRef.current = sessionOf(who, team);
    return { team, board };
  }

  it("lets an Owner edit a Board of their own Team", async () => {
    const { team, board } = await setup("owner");
    const result = await editBoardAction(
      null,
      form({ visibility: "public", boardId: board.id, name: "Defects", slug: "defects" }),
    );
    expect(result).toEqual({ ok: true, boardName: "Defects" });
    expect((await getBoardBySlugs(ctx.db, team.slug, "defects"))?.board.id).toBe(board.id);
    expect(revalidate).toHaveBeenCalledWith("/dashboard");
  });

  it("refuses a plain Member and changes nothing", async () => {
    const { team, board } = await setup("member");
    expect(
      await editBoardAction(
        null,
        form({ visibility: "public", boardId: board.id, name: "Defects", slug: "defects" }),
      ),
    ).toEqual({ ok: false, error: "forbidden" });
    expect((await getBoardBySlugs(ctx.db, team.slug, "bugs"))?.board.name).toBe("Bugs");
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("refuses someone signed out", async () => {
    const { board } = await setup("owner");
    sessionRef.current = null;
    expect(
      await editBoardAction(
        null,
        form({ visibility: "public", boardId: board.id, name: "Defects", slug: "defects" }),
      ),
    ).toEqual({ ok: false, error: "forbidden" });
  });

  it("will not edit a Board of another Team, even with its id", async () => {
    const { team } = await setup("owner");
    const other = await newTeam();
    const theirs = await createBoard(ctx.db, { teamId: other.id, name: "Theirs", slug: "theirs" });
    expect(
      await editBoardAction(
        null,
        form({ visibility: "public", boardId: theirs.id, name: "Mine now", slug: "mine" }),
      ),
    ).toEqual({ ok: false, error: "not-found" });
    expect((await getBoardBySlugs(ctx.db, other.slug, "theirs"))?.board.name).toBe("Theirs");
    expect(await getBoardBySlugs(ctx.db, team.slug, "mine")).toBeNull();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("refuses an edit that leaves out the visibility and keeps a Private board Private", async () => {
    const { team, board } = await setup("owner");
    await ctx.db.update(boards).set({ visibility: "private" }).where(eq(boards.id, board.id));
    const body = new FormData();
    body.set("boardId", board.id);
    body.set("name", "Defects");
    body.set("slug", "bugs");
    expect(await editBoardAction(null, body)).toMatchObject({ ok: false, error: "invalid" });
    expect((await getBoardBySlugs(ctx.db, team.slug, "bugs"))?.board.visibility).toBe("private");
  });

  it("handles a missing boardId without error", async () => {
    await setup("owner");
    expect(
      await editBoardAction(null, form({ visibility: "public", name: "X1", slug: "xx" })),
    ).toEqual({
      ok: false,
      error: "not-found",
    });
  });
});

describe("rotateShareLinkAction (US-4.2, US-3.6)", () => {
  async function setup(role: "owner" | "member") {
    const team = await newTeam();
    const board = await createBoard(ctx.db, {
      teamId: team.id,
      name: "Secret",
      slug: "secret",
      visibility: "private",
    });
    const who = await join(team.id, role);
    sessionRef.current = sessionOf(who, team);
    return { team, board };
  }

  it("lets an Owner make a share link and returns it once", async () => {
    const { board } = await setup("owner");
    const result = await rotateShareLinkAction(board.id);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("expected ok");
    expect(result.sharePath).toMatch(/^\/join\/board\/[A-Za-z0-9_-]{43}$/);
    expect(await findActiveBoardShareLink(ctx.db, board.id)).not.toBeNull();
    expect(revalidate).toHaveBeenCalledWith("/dashboard");
  });

  it("refuses a plain Member and makes nothing", async () => {
    const { board } = await setup("member");
    expect(await rotateShareLinkAction(board.id)).toEqual({ ok: false, error: "forbidden" });
    expect(await findActiveBoardShareLink(ctx.db, board.id)).toBeNull();
  });

  it("refuses someone signed out", async () => {
    const { board } = await setup("owner");
    sessionRef.current = null;
    expect(await rotateShareLinkAction(board.id)).toEqual({ ok: false, error: "forbidden" });
    expect(await findActiveBoardShareLink(ctx.db, board.id)).toBeNull();
  });

  it("will not make a link for a Board of another Team", async () => {
    await setup("owner");
    const other = await newTeam();
    const theirs = await createBoard(ctx.db, {
      teamId: other.id,
      name: "Theirs",
      slug: "theirs",
      visibility: "private",
    });
    expect(await rotateShareLinkAction(theirs.id)).toEqual({ ok: false, error: "not-found" });
    expect(await findActiveBoardShareLink(ctx.db, theirs.id)).toBeNull();
  });

  it("handles a non-string board id without error", async () => {
    await setup("owner");
    expect(await rotateShareLinkAction(undefined as unknown as string)).toEqual({
      ok: false,
      error: "not-found",
    });
  });
});
