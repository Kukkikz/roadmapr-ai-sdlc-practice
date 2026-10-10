import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createMember } from "@/data";
import { accessLinks, teams } from "@/db/schema";
import { createInviteLink } from "@/lib/invite-links";
import { hashToken } from "@/lib/link-token";
import { createTestDb } from "./helpers/db";

// The signed-in Member and Team that `getSession` reports (or null).
type Fake = {
  member: { id: string; teamId: string; role: "owner" | "member" };
  team: { id: string };
};
const sessionRef = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sessionRef.current }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));

let ctx: Awaited<ReturnType<typeof createTestDb>>;
vi.mock("@/db", () => ({ getDb: () => ctx.db }));

const { generateInviteAction, revokeInviteAction } =
  await import("@/components/team/invite-actions");

const signIn = (teamId: string, role: "owner" | "member"): Fake => ({
  member: { id: `m-${teamId}-${role}`, teamId, role },
  team: { id: teamId },
});

const linksOf = async (teamId: string) =>
  ctx.db.select().from(accessLinks).where(eq(accessLinks.teamId, teamId));
const form = (data: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(data)) body.set(key, value);
  return body;
};

beforeAll(async () => {
  ctx = await createTestDb();
  for (const id of ["A", "B"]) {
    await ctx.db.insert(teams).values({ id, name: `Team ${id}`, slug: `team-${id.toLowerCase()}` });
    await createMember(ctx.db, { teamId: id, displayName: "Owner", role: "owner" });
  }
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(() => {
  sessionRef.current = null;
  revalidate.mockClear();
});

describe("generateInviteAction (US-3.3, US-3.6)", () => {
  it("lets an Owner make an invite link for their own Team and returns it once", async () => {
    sessionRef.current = signIn("A", "owner");
    const result = await generateInviteAction();
    if (!result.ok) throw new Error("expected success");

    const token = result.invitePath.replace("/join/", "");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = await linksOf("A");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ kind: "member_invite", teamId: "A" });
    expect(stored[0].tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(revalidate).toHaveBeenCalledWith("/dashboard");
  });

  it("refuses a plain Member and creates nothing", async () => {
    sessionRef.current = signIn("A", "member");
    const before = (await linksOf("A")).length;
    expect(await generateInviteAction()).toEqual({ ok: false, error: "forbidden" });
    expect(await linksOf("A")).toHaveLength(before);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("refuses someone who is signed out", async () => {
    expect(await generateInviteAction()).toEqual({ ok: false, error: "forbidden" });
  });

  it("makes the link for the Session's Team only: a Team B Owner cannot make one for Team A", async () => {
    sessionRef.current = signIn("B", "owner");
    const before = (await linksOf("A")).length;
    const result = await generateInviteAction();
    expect(result).toMatchObject({ ok: true });
    expect(await linksOf("A")).toHaveLength(before);
    expect(await linksOf("B")).toHaveLength(1);
  });

  it("refuses a Session whose Member and Team disagree", async () => {
    sessionRef.current = { member: { id: "x", teamId: "A", role: "owner" }, team: { id: "B" } };
    expect(await generateInviteAction()).toEqual({ ok: false, error: "forbidden" });
  });
});

describe("revokeInviteAction (US-3.3, US-3.6)", () => {
  const revokedAt = async (id: string) =>
    (await ctx.db.select().from(accessLinks).where(eq(accessLinks.id, id)))[0].revokedAt;

  it("lets an Owner revoke their own Team's link", async () => {
    const link = await createInviteLink(ctx.db, "A");
    sessionRef.current = signIn("A", "owner");
    await revokeInviteAction(form({ linkId: link.id }));
    expect(await revokedAt(link.id)).not.toBeNull();
    expect(revalidate).toHaveBeenCalledWith("/dashboard");
  });

  it("refuses a plain Member: the link keeps working", async () => {
    const link = await createInviteLink(ctx.db, "A");
    sessionRef.current = signIn("A", "member");
    await revokeInviteAction(form({ linkId: link.id }));
    expect(await revokedAt(link.id)).toBeNull();
  });

  it("refuses someone signed out", async () => {
    const link = await createInviteLink(ctx.db, "A");
    await revokeInviteAction(form({ linkId: link.id }));
    expect(await revokedAt(link.id)).toBeNull();
  });

  it("cannot revoke another Team's link by guessing or knowing its id", async () => {
    const theirs = await createInviteLink(ctx.db, "A");
    sessionRef.current = signIn("B", "owner");
    await revokeInviteAction(form({ linkId: theirs.id }));
    expect(await revokedAt(theirs.id)).toBeNull();
  });

  it("ignores a missing, empty or non-text linkId without error", async () => {
    sessionRef.current = signIn("A", "owner");
    await expect(revokeInviteAction(form({}))).resolves.toBeUndefined();
    await expect(revokeInviteAction(form({ linkId: "" }))).resolves.toBeUndefined();
    const body = new FormData();
    body.set("linkId", new File(["x"], "x.txt"));
    await expect(revokeInviteAction(body)).resolves.toBeUndefined();
  });
});
