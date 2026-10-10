import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMember, getTeamBySlug } from "@/data";
import { teams } from "@/db/schema";
import { createTestDb } from "./helpers/db";

const sessionRef = vi.hoisted(() => ({ current: null as unknown }));
const clearCookie = vi.hoisted(() => vi.fn());
vi.mock("@/lib/session", () => ({
  getSession: async () => sessionRef.current,
  clearSessionCookie: clearCookie,
}));
const redirect = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));

let ctx: Awaited<ReturnType<typeof createTestDb>>;
vi.mock("@/db", () => ({ getDb: () => ctx.db }));

const { deleteTeamAction } = await import("@/components/team/delete-team-action");

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
const exists = async (slug: string) => (await getTeamBySlug(ctx.db, slug)) !== null;

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(() => {
  sessionRef.current = null;
  clearCookie.mockClear();
  redirect.mockClear();
});

describe("deleteTeamAction (US-3.8, US-3.6)", () => {
  it("lets an Owner delete their Team with its slug: cookie cleared, sent to the goodbye page", async () => {
    const team = await newTeam();
    const owner = await join(team.id, "owner");
    sessionRef.current = sessionOf(owner, team);
    await expect(deleteTeamAction(null, form({ confirmation: team.slug }))).rejects.toThrow(
      "NEXT_REDIRECT:/team-deleted",
    );
    expect(await exists(team.slug)).toBe(false);
    expect(clearCookie).toHaveBeenCalledOnce();
  });

  it("deletes nothing on a wrong, empty or missing confirmation, and stays signed in", async () => {
    const team = await newTeam();
    const owner = await join(team.id, "owner");
    sessionRef.current = sessionOf(owner, team);
    const wrong: Record<string, string>[] = [
      {},
      { confirmation: "" },
      { confirmation: `${team.slug}-x` },
    ];
    for (const data of wrong) {
      expect(await deleteTeamAction(null, form(data))).toEqual({
        ok: false,
        error: "wrong_confirmation",
      });
    }
    const file = new FormData();
    file.set("confirmation", new File(["x"], "x.txt"));
    expect(await deleteTeamAction(null, file)).toEqual({
      ok: false,
      error: "wrong_confirmation",
    });
    expect(await exists(team.slug)).toBe(true);
    expect(clearCookie).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses a plain Member even with the right slug", async () => {
    const team = await newTeam();
    await join(team.id, "owner");
    const bo = await join(team.id, "member");
    sessionRef.current = sessionOf(bo, team);
    expect(await deleteTeamAction(null, form({ confirmation: team.slug }))).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await exists(team.slug)).toBe(true);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses someone signed out", async () => {
    const team = await newTeam();
    expect(await deleteTeamAction(null, form({ confirmation: team.slug }))).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await exists(team.slug)).toBe(true);
  });

  it("only ever deletes the Session's Team: another Team's slug, even typed, does nothing to it", async () => {
    const mine = await newTeam();
    const theirs = await newTeam();
    const me = await join(mine.id, "owner");
    sessionRef.current = sessionOf(me, mine);
    expect(await deleteTeamAction(null, form({ confirmation: theirs.slug }))).toEqual({
      ok: false,
      error: "wrong_confirmation",
    });
    expect(await exists(theirs.slug)).toBe(true);
    expect(await exists(mine.slug)).toBe(true);
  });

  it("ignores any team id or slug field in the request", async () => {
    const mine = await newTeam();
    const theirs = await newTeam();
    const me = await join(mine.id, "owner");
    sessionRef.current = sessionOf(me, mine);
    await expect(
      deleteTeamAction(
        null,
        form({ confirmation: mine.slug, teamId: theirs.id, slug: theirs.slug }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/team-deleted");
    expect(await exists(mine.slug)).toBe(false);
    expect(await exists(theirs.slug)).toBe(true);
  });

  it("refuses a Session whose Member and Team disagree", async () => {
    const a = await newTeam();
    const b = await newTeam();
    const ada = await join(a.id, "owner");
    sessionRef.current = sessionOf(ada, b);
    expect(await deleteTeamAction(null, form({ confirmation: b.slug }))).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await exists(a.slug)).toBe(true);
    expect(await exists(b.slug)).toBe(true);
  });
});
