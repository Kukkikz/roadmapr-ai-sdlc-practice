import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMember, findActiveMember } from "@/data";
import { teams } from "@/db/schema";
import { createTestDb } from "./helpers/db";

// The signed-in Member and Team that `getSession` reports (or null).
const sessionRef = vi.hoisted(() => ({ current: null as unknown }));
const clearCookie = vi.hoisted(() => vi.fn());
vi.mock("@/lib/session", () => ({
  getSession: async () => sessionRef.current,
  clearSessionCookie: clearCookie,
}));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
const redirect = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));

let ctx: Awaited<ReturnType<typeof createTestDb>>;
vi.mock("@/db", () => ({ getDb: () => ctx.db }));

const { leaveTeamAction, removeMemberAction } = await import("@/components/team/member-actions");

type Who = { id: string; teamId: string; role: "owner" | "member" };
const sessionOf = (who: Who) => ({ member: who, team: { id: who.teamId } });
const form = (data: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(data)) body.set(key, value);
  return body;
};
let counter = 0;

async function newTeam() {
  const id = `team-${++counter}`;
  await ctx.db.insert(teams).values({ id, name: id, slug: id });
  return id;
}
const join = async (teamId: string, role: "owner" | "member", name = `m${++counter}`) => {
  const row = await createMember(ctx.db, { teamId, displayName: name, role });
  return { id: row.id, teamId, role } satisfies Who;
};
const isActive = async (who: Who) => (await findActiveMember(ctx.db, who.teamId, who.id)) !== null;

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
  revalidate.mockClear();
});

describe("removeMemberAction (US-3.4, US-3.6)", () => {
  it("lets an Owner remove a Member of their own Team", async () => {
    const team = await newTeam();
    const owner = await join(team, "owner");
    const bo = await join(team, "member");
    sessionRef.current = sessionOf(owner);
    await removeMemberAction(form({ memberId: bo.id }));
    expect(await isActive(bo)).toBe(false);
    expect(revalidate).toHaveBeenCalledWith("/dashboard");
  });

  it("refuses a plain Member, even on a fellow Member", async () => {
    const team = await newTeam();
    await join(team, "owner");
    const bo = await join(team, "member");
    const cy = await join(team, "member");
    sessionRef.current = sessionOf(bo);
    await removeMemberAction(form({ memberId: cy.id }));
    expect(await isActive(cy)).toBe(true);
  });

  it("refuses someone signed out", async () => {
    const team = await newTeam();
    await join(team, "owner");
    const bo = await join(team, "member");
    await removeMemberAction(form({ memberId: bo.id }));
    expect(await isActive(bo)).toBe(true);
  });

  it("cannot remove a Member of another Team by knowing their id", async () => {
    const mine = await newTeam();
    const theirs = await newTeam();
    const myOwner = await join(mine, "owner");
    await join(theirs, "owner");
    const victim = await join(theirs, "member");
    sessionRef.current = sessionOf(myOwner);
    await removeMemberAction(form({ memberId: victim.id }));
    expect(await isActive(victim)).toBe(true);
  });

  it("never removes the last Owner, even when the last Owner asks", async () => {
    const team = await newTeam();
    const owner = await join(team, "owner");
    sessionRef.current = sessionOf(owner);
    await removeMemberAction(form({ memberId: owner.id }));
    expect(await isActive(owner)).toBe(true);
  });

  it("ignores a missing, empty or non-text memberId", async () => {
    const team = await newTeam();
    const owner = await join(team, "owner");
    sessionRef.current = sessionOf(owner);
    await expect(removeMemberAction(form({}))).resolves.toBeUndefined();
    await expect(removeMemberAction(form({ memberId: "" }))).resolves.toBeUndefined();
    const body = new FormData();
    body.set("memberId", new File(["x"], "x.txt"));
    await expect(removeMemberAction(body)).resolves.toBeUndefined();
    expect(await isActive(owner)).toBe(true);
  });
});

describe("leaveTeamAction (US-3.7)", () => {
  it("lets a Member leave: removed, cookie cleared, sent home", async () => {
    const team = await newTeam();
    await join(team, "owner");
    const bo = await join(team, "member");
    sessionRef.current = sessionOf(bo);
    await expect(leaveTeamAction()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(await isActive(bo)).toBe(false);
    expect(clearCookie).toHaveBeenCalledOnce();
  });

  it("lets an Owner leave while another Owner remains", async () => {
    const team = await newTeam();
    const ada = await join(team, "owner");
    const bea = await join(team, "owner");
    sessionRef.current = sessionOf(ada);
    await expect(leaveTeamAction()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(await isActive(ada)).toBe(false);
    expect(await isActive(bea)).toBe(true);
  });

  it("does not let the last Owner leave, and does not sign them out", async () => {
    const team = await newTeam();
    const owner = await join(team, "owner");
    await join(team, "member");
    sessionRef.current = sessionOf(owner);
    await expect(leaveTeamAction()).resolves.toBeUndefined();
    expect(await isActive(owner)).toBe(true);
    expect(clearCookie).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does nothing for someone signed out", async () => {
    await expect(leaveTeamAction()).resolves.toBeUndefined();
    expect(clearCookie).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("only ever removes the signed-in Member, never someone else", async () => {
    const team = await newTeam();
    await join(team, "owner");
    const bo = await join(team, "member");
    const cy = await join(team, "member");
    sessionRef.current = sessionOf(bo);
    await expect(leaveTeamAction()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(await isActive(cy)).toBe(true);
  });
});
