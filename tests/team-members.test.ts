import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  createAccessLink,
  createMember,
  createSession,
  findActiveMember,
  findSessionByHash,
  listActiveMembers,
} from "@/data";
import { members, sessions, teams } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/link-token";
import { previewLink } from "@/lib/redeem";
import { removeTeamMember } from "@/lib/team-members";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;
const NOW = new Date("2026-03-01T12:00:00Z");
const LATER = new Date(NOW.getTime() + 1000);

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

async function newTeam() {
  const n = ++counter;
  const id = `team-${n}`;
  await ctx.db.insert(teams).values({ id, name: `Team ${n}`, slug: `team-${n}` });
  return id;
}

async function signedIn(teamId: string, displayName: string, role: "owner" | "member") {
  const member = await createMember(ctx.db, { teamId, displayName, role });
  const token = generateToken();
  await createSession(ctx.db, {
    tokenHash: hashToken(token),
    memberId: member.id,
    expiresAt: new Date(NOW.getTime() + 86_400_000),
  });
  return { member, token };
}

describe("removeTeamMember (US-3.4, G8)", () => {
  it("removes a Member softly: the row and its name stay", async () => {
    const team = await newTeam();
    await signedIn(team, "Ada", "owner");
    const bo = await signedIn(team, "Bo", "member");

    expect(await removeTeamMember(ctx.db, team, bo.member.id, LATER)).toBe("removed");

    const [row] = await ctx.db.select().from(members).where(eq(members.id, bo.member.id));
    expect(row).toMatchObject({ displayName: "Bo", role: "member" });
    expect(row.removedAt?.getTime()).toBe(LATER.getTime());
    expect(await findActiveMember(ctx.db, team, bo.member.id)).toBeNull();
  });

  it("ends the removed Member's Sessions at once, on every device, and no one else's", async () => {
    const team = await newTeam();
    const ada = await signedIn(team, "Ada", "owner");
    const bo = await signedIn(team, "Bo", "member");
    const boPhone = generateToken();
    await createSession(ctx.db, {
      tokenHash: hashToken(boPhone),
      memberId: bo.member.id,
      expiresAt: new Date(NOW.getTime() + 86_400_000),
    });

    await removeTeamMember(ctx.db, team, bo.member.id, LATER);

    expect(await findSessionByHash(ctx.db, hashToken(bo.token), LATER)).toBeNull();
    expect(await findSessionByHash(ctx.db, hashToken(boPhone), LATER)).toBeNull();
    expect(await ctx.db.select().from(sessions).where(eq(sessions.memberId, bo.member.id))).toEqual(
      [],
    );
    expect(await findSessionByHash(ctx.db, hashToken(ada.token), LATER)).not.toBeNull();
  });

  it("is no longer listed, while everyone else still is", async () => {
    const team = await newTeam();
    await signedIn(team, "Ada", "owner");
    const bo = await signedIn(team, "Bo", "member");
    await signedIn(team, "Cy", "member");
    await removeTeamMember(ctx.db, team, bo.member.id, LATER);
    expect((await listActiveMembers(ctx.db, team)).map((m) => m.displayName)).toEqual([
      "Ada",
      "Cy",
    ]);
  });

  it("lists Owners first, then Members in the order they joined", async () => {
    const team = await newTeam();
    await signedIn(team, "First member", "member");
    await signedIn(team, "An owner", "owner");
    await signedIn(team, "Second member", "member");
    expect((await listActiveMembers(ctx.db, team)).map((m) => m.displayName)).toEqual([
      "An owner",
      "First member",
      "Second member",
    ]);
  });

  it("kills a removed Owner's Owner link", async () => {
    const team = await newTeam();
    await signedIn(team, "Ada", "owner");
    const bea = await signedIn(team, "Bea", "owner");
    const token = generateToken();
    await createAccessLink(ctx.db, {
      teamId: team,
      kind: "owner",
      tokenHash: hashToken(token),
      memberId: bea.member.id,
    });
    expect(await previewLink(ctx.db, "owner", token, NOW)).toMatchObject({ ok: true });
    expect(await removeTeamMember(ctx.db, team, bea.member.id, LATER)).toBe("removed");
    expect(await previewLink(ctx.db, "owner", token, LATER)).toEqual({ ok: false });
  });

  it("never removes the last Owner, even with Members left", async () => {
    const team = await newTeam();
    const ada = await signedIn(team, "Ada", "owner");
    await signedIn(team, "Bo", "member");
    expect(await removeTeamMember(ctx.db, team, ada.member.id, LATER)).toBe("last_owner");
    expect(await findActiveMember(ctx.db, team, ada.member.id)).not.toBeNull();
    expect(await findSessionByHash(ctx.db, hashToken(ada.token), LATER)).not.toBeNull();
  });

  it("removes an Owner while another Owner remains, then protects the survivor", async () => {
    const team = await newTeam();
    const ada = await signedIn(team, "Ada", "owner");
    const bea = await signedIn(team, "Bea", "owner");
    expect(await removeTeamMember(ctx.db, team, ada.member.id, LATER)).toBe("removed");
    expect(await removeTeamMember(ctx.db, team, bea.member.id, LATER)).toBe("last_owner");
  });

  it("refuses a Member of another Team and changes nothing", async () => {
    const mine = await newTeam();
    const theirs = await newTeam();
    await signedIn(theirs, "Ada", "owner");
    const victim = await signedIn(theirs, "Vic", "member");
    expect(await removeTeamMember(ctx.db, mine, victim.member.id, LATER)).toBe("not_found");
    expect(await findActiveMember(ctx.db, theirs, victim.member.id)).not.toBeNull();
    expect(await findSessionByHash(ctx.db, hashToken(victim.token), LATER)).not.toBeNull();
  });

  it("does nothing for an unknown id or someone already removed", async () => {
    const team = await newTeam();
    await signedIn(team, "Ada", "owner");
    const bo = await signedIn(team, "Bo", "member");
    expect(await removeTeamMember(ctx.db, team, "no-such-member", LATER)).toBe("not_found");
    expect(await removeTeamMember(ctx.db, team, bo.member.id, LATER)).toBe("removed");
    const again = new Date(LATER.getTime() + 5000);
    expect(await removeTeamMember(ctx.db, team, bo.member.id, again)).toBe("not_found");
    const [row] = await ctx.db.select().from(members).where(eq(members.id, bo.member.id));
    expect(row.removedAt?.getTime()).toBe(LATER.getTime());
  });
});
