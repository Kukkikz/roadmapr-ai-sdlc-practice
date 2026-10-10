import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  addComment,
  addVote,
  assignTag,
  createAccessLink,
  createBoard,
  createIdea,
  createMember,
  createSession,
  createTag,
  findSessionByHash,
  getBoardBySlugs,
  getIdea,
  getTeamBySlug,
  listComments,
} from "@/data";
import { accessLinks, comments, members, sessions, teams, votes } from "@/db/schema";
import { createTeamWithOwner } from "@/lib/create-team";
import { deleteTeamConfirmed } from "@/lib/delete-team";
import { generateToken, hashToken } from "@/lib/link-token";
import { previewLink } from "@/lib/redeem";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;
const NOW = new Date("2026-03-01T12:00:00Z");

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

/** A Team with everything the delete is meant to take with it. */
async function fullTeam() {
  const n = ++counter;
  const team = { id: `team-${n}`, name: `Team ${n}`, slug: `team-${n}` };
  await ctx.db.insert(teams).values(team);
  const owner = await createMember(ctx.db, { teamId: team.id, displayName: "Ada", role: "owner" });
  const bo = await createMember(ctx.db, { teamId: team.id, displayName: "Bo", role: "member" });
  const board = await createBoard(ctx.db, { teamId: team.id, name: "Ideas", slug: "ideas" });
  const idea = await createIdea(ctx.db, { boardId: board.id, title: "Idea", actorId: "anon:x" });
  await addComment(ctx.db, { ideaId: idea.id, body: "Hello", actorId: `member:${bo.id}` });
  await addVote(ctx.db, idea.id, "anon:voter");
  const tag = await createTag(ctx.db, { boardId: board.id, name: "bug", color: "#cc0000" });
  await assignTag(ctx.db, idea.id, tag.id);

  const ownerToken = generateToken();
  await createAccessLink(ctx.db, {
    teamId: team.id,
    kind: "owner",
    tokenHash: hashToken(ownerToken),
    memberId: owner.id,
  });
  const inviteToken = generateToken();
  await createAccessLink(ctx.db, {
    teamId: team.id,
    kind: "member_invite",
    tokenHash: hashToken(inviteToken),
    expiresAt: new Date(NOW.getTime() + 86_400_000),
  });
  const shareToken = generateToken();
  await createAccessLink(ctx.db, {
    teamId: team.id,
    kind: "board_share",
    tokenHash: hashToken(shareToken),
    boardId: board.id,
  });
  const sessionToken = generateToken();
  await createSession(ctx.db, {
    tokenHash: hashToken(sessionToken),
    memberId: bo.id,
    expiresAt: new Date(NOW.getTime() + 86_400_000),
  });
  return { team, owner, bo, board, idea, ownerToken, inviteToken, shareToken, sessionToken };
}

describe("deleteTeamConfirmed (US-3.8, G8)", () => {
  it("deletes nothing unless the exact slug is typed", async () => {
    const t = await fullTeam();
    for (const wrong of [
      "",
      "   ",
      t.team.slug.toUpperCase(),
      `${t.team.slug}x`,
      t.team.slug.slice(1),
      t.team.name,
      undefined,
      null,
      42,
      { slug: t.team.slug },
    ]) {
      expect(await deleteTeamConfirmed(ctx.db, t.team, wrong)).toBe("wrong_confirmation");
    }
    expect(await getTeamBySlug(ctx.db, t.team.slug)).not.toBeNull();
    expect(await getIdea(ctx.db, t.idea.id)).not.toBeNull();
  });

  it("deletes the Team for good when the slug matches (surrounding spaces aside)", async () => {
    const t = await fullTeam();
    expect(await deleteTeamConfirmed(ctx.db, t.team, `  ${t.team.slug} `)).toBe("deleted");
    expect(await getTeamBySlug(ctx.db, t.team.slug)).toBeNull();
  });

  it("takes everything under the Team with it", async () => {
    const t = await fullTeam();
    await deleteTeamConfirmed(ctx.db, t.team, t.team.slug);

    expect(await getBoardBySlugs(ctx.db, t.team.slug, "ideas")).toBeNull();
    expect(await getIdea(ctx.db, t.idea.id)).toBeNull();
    expect(await listComments(ctx.db, t.idea.id, { includeHidden: true })).toEqual([]);
    expect(await ctx.db.select().from(votes).where(eq(votes.ideaId, t.idea.id))).toEqual([]);
    expect(await ctx.db.select().from(members).where(eq(members.teamId, t.team.id))).toEqual([]);
    expect(
      await ctx.db.select().from(accessLinks).where(eq(accessLinks.teamId, t.team.id)),
    ).toEqual([]);
    expect(await ctx.db.select().from(comments).where(eq(comments.ideaId, t.idea.id))).toEqual([]);
  });

  it("stops every link and Session of the Team working", async () => {
    const t = await fullTeam();
    await deleteTeamConfirmed(ctx.db, t.team, t.team.slug);

    expect(await previewLink(ctx.db, "owner", t.ownerToken, NOW)).toEqual({ ok: false });
    expect(await previewLink(ctx.db, "member_invite", t.inviteToken, NOW)).toEqual({ ok: false });
    expect(await findSessionByHash(ctx.db, hashToken(t.sessionToken), NOW)).toBeNull();
    expect(await ctx.db.select().from(sessions).where(eq(sessions.memberId, t.bo.id))).toEqual([]);
    expect(
      await ctx.db
        .select()
        .from(accessLinks)
        .where(eq(accessLinks.tokenHash, hashToken(t.shareToken))),
    ).toEqual([]);
  });

  it("frees the slug at once: a new Team can claim it", async () => {
    const t = await fullTeam();
    await deleteTeamConfirmed(ctx.db, t.team, t.team.slug);
    const again = await createTeamWithOwner(
      ctx.db,
      "198.51.100.77",
      {
        teamName: "Reborn",
        teamSlug: t.team.slug,
        boardName: "Ideas",
        displayName: "Zed",
      },
      { now: NOW },
    );
    expect(again).toMatchObject({ ok: true, teamName: "Reborn" });
    expect((await getTeamBySlug(ctx.db, t.team.slug))?.id).not.toBe(t.team.id);
  });

  it("leaves other Teams untouched", async () => {
    const mine = await fullTeam();
    const theirs = await fullTeam();
    await deleteTeamConfirmed(ctx.db, mine.team, mine.team.slug);

    expect(await getTeamBySlug(ctx.db, theirs.team.slug)).not.toBeNull();
    expect(await getIdea(ctx.db, theirs.idea.id)).not.toBeNull();
    expect(await previewLink(ctx.db, "owner", theirs.ownerToken, NOW)).toMatchObject({ ok: true });
    expect(await findSessionByHash(ctx.db, hashToken(theirs.sessionToken), NOW)).not.toBeNull();
  });

  it("never deletes another Team just because its slug was typed for this one", async () => {
    const mine = await fullTeam();
    const theirs = await fullTeam();
    expect(await deleteTeamConfirmed(ctx.db, mine.team, theirs.team.slug)).toBe(
      "wrong_confirmation",
    );
    expect(await getTeamBySlug(ctx.db, mine.team.slug)).not.toBeNull();
    expect(await getTeamBySlug(ctx.db, theirs.team.slug)).not.toBeNull();
  });
});
