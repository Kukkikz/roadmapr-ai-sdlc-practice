import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createAccessLink, createMember } from "@/data";
import { accessLinks, teams } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/link-token";
import { previewLink } from "@/lib/redeem";
import { createTestDb } from "./helpers/db";

const sessionRef = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sessionRef.current }));

const revalidate = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));

let ctx: Awaited<ReturnType<typeof createTestDb>>;
vi.mock("@/db", () => ({ getDb: () => ctx.db }));

const { replaceOwnerLinkAction } = await import("@/components/team/owner-link-actions");

type Who = { id: string; teamId: string; role: "owner" | "member" };
const sessionOf = (who: Who) => ({ member: who, team: { id: who.teamId } });
let counter = 0;

async function newTeam() {
  const id = `team-${++counter}`;
  await ctx.db.insert(teams).values({ id, name: id, slug: id });
  return id;
}
async function join(teamId: string, role: "owner" | "member") {
  const row = await createMember(ctx.db, { teamId, displayName: `m${++counter}`, role });
  return { id: row.id, teamId, role } satisfies Who;
}
async function ownerLink(who: Who) {
  const token = generateToken();
  await createAccessLink(ctx.db, {
    teamId: who.teamId,
    kind: "owner",
    tokenHash: hashToken(token),
    memberId: who.id,
  });
  return token;
}
const works = async (token: string) => (await previewLink(ctx.db, "owner", token)).ok;
const linkCount = async (teamId: string) =>
  (await ctx.db.select().from(accessLinks).where(eq(accessLinks.teamId, teamId))).length;

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

describe("replaceOwnerLinkAction (US-3.2, US-3.6)", () => {
  it("lets an Owner replace their own link and returns the new one once", async () => {
    const team = await newTeam();
    const ada = await join(team, "owner");
    const old = await ownerLink(ada);
    sessionRef.current = sessionOf(ada);

    const result = await replaceOwnerLinkAction();
    if (!result.ok) throw new Error("expected success");

    const token = result.ownerLinkPath.replace("/login/", "");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await works(token)).toBe(true);
    expect(await works(old)).toBe(false);
    expect(revalidate).toHaveBeenCalledWith("/dashboard");
    const stored = JSON.stringify(await ctx.db.select().from(accessLinks));
    expect(stored).not.toContain(token);
  });

  it("refuses a plain Member and creates nothing", async () => {
    const team = await newTeam();
    await join(team, "owner");
    const bo = await join(team, "member");
    sessionRef.current = sessionOf(bo);
    const before = await linkCount(team);
    expect(await replaceOwnerLinkAction()).toEqual({ ok: false, error: "forbidden" });
    expect(await linkCount(team)).toBe(before);
  });

  it("refuses someone signed out", async () => {
    expect(await replaceOwnerLinkAction()).toEqual({ ok: false, error: "forbidden" });
  });

  it("only ever replaces the signed-in Owner's own link, never another Owner's", async () => {
    const team = await newTeam();
    const ada = await join(team, "owner");
    const bea = await join(team, "owner");
    const adaOld = await ownerLink(ada);
    const beaOld = await ownerLink(bea);
    sessionRef.current = sessionOf(ada);
    await replaceOwnerLinkAction();
    expect(await works(adaOld)).toBe(false);
    expect(await works(beaOld)).toBe(true);
  });

  it("leaves another Team's Owner link alone", async () => {
    const mine = await newTeam();
    const theirs = await newTeam();
    const me = await join(mine, "owner");
    const other = await join(theirs, "owner");
    const otherLink = await ownerLink(other);
    sessionRef.current = sessionOf(me);
    await replaceOwnerLinkAction();
    expect(await works(otherLink)).toBe(true);
  });

  it("refuses a Session whose Member and Team disagree", async () => {
    const a = await newTeam();
    const b = await newTeam();
    const ada = await join(a, "owner");
    sessionRef.current = { member: ada, team: { id: b } };
    const before = await linkCount(a);
    expect(await replaceOwnerLinkAction()).toEqual({ ok: false, error: "forbidden" });
    expect(await linkCount(a)).toBe(before);
    expect(await linkCount(b)).toBe(0);
  });
});
