import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createBoard,
  createIdea,
  createMember,
  getIdea,
  listComments,
  softRemoveMember,
} from "@/data";
import { teams } from "@/db/schema";
import { authorNameFor } from "@/lib/author";
import { postingAsFor } from "@/lib/posting-as";
import { submitComment } from "@/lib/submit-comment";
import { submitIdea } from "@/lib/submit-idea";
import type { Visitor } from "@/lib/visitor";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;
const ip = () => `203.0.113.${++counter % 250}`;

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

async function setup() {
  const n = ++counter;
  const teamId = `team-${n}`;
  await ctx.db.insert(teams).values({ id: teamId, name: `Team ${n}`, slug: teamId });
  const board = await createBoard(ctx.db, { teamId, name: "Ideas", slug: "ideas" });
  const idea = await createIdea(ctx.db, {
    boardId: board.id,
    title: "An idea",
    actorId: "anon:author",
  });
  return { teamId, board, idea };
}

async function memberOf(teamId: string, displayName: string): Promise<Visitor> {
  const row = await createMember(ctx.db, { teamId, displayName, role: "member" });
  return {
    anonId: `member:${row.id}`,
    actorId: `member:${row.id}`,
    memberId: row.id,
    teamId,
    displayName,
  };
}

const visitor = (): Visitor => {
  const anonId = `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
  return { anonId, actorId: `anon:${anonId}` };
};

describe("a signed-in Member posts under their own name (US-5.4)", () => {
  it("stores the Session's display name on a Comment, whatever name the request carries", async () => {
    const { teamId, idea } = await setup();
    const olga = await memberOf(teamId, "Olga");
    const result = await submitComment(ctx.db, olga, ip(), {
      ideaId: idea.id,
      body: "We are on it",
      authorName: "The CEO",
    });
    expect(result).toMatchObject({ ok: true });
    const [comment] = await listComments(ctx.db, idea.id);
    expect(comment).toMatchObject({
      authorName: "Olga",
      actorId: olga.actorId,
      authorTeamId: teamId,
    });
  });

  it("does the same for an Idea", async () => {
    const { teamId, board } = await setup();
    const olga = await memberOf(teamId, "Olga");
    const result = await submitIdea(ctx.db, olga, ip(), {
      boardId: board.id,
      title: "From the team",
      authorName: "Someone else",
    });
    if (!result.ok || !result.ideaId) throw new Error("expected success");
    const idea = await getIdea(ctx.db, result.ideaId);
    expect(idea).toMatchObject({ authorName: "Olga", authorTeamId: teamId });
  });

  it("leaves a Visitor's typed name alone and marks them as no Team", async () => {
    const { idea } = await setup();
    await submitComment(ctx.db, visitor(), ip(), {
      ideaId: idea.id,
      body: "Hello",
      authorName: "Pat",
    });
    await submitComment(ctx.db, visitor(), ip(), { ideaId: idea.id, body: "Anonymous one" });
    const list = await listComments(ctx.db, idea.id);
    expect(list.map((c) => [c.authorName, c.authorTeamId])).toEqual([
      ["Pat", null],
      [null, null],
    ]);
  });

  it("a typed name that looks like a Member's cannot make a Visitor a Team author", async () => {
    const { teamId, idea } = await setup();
    await memberOf(teamId, "Olga");
    await submitComment(ctx.db, visitor(), ip(), {
      ideaId: idea.id,
      body: "I am the team",
      authorName: "Olga",
    });
    const [comment] = await listComments(ctx.db, idea.id);
    expect(comment.authorTeamId).toBeNull();
  });
});

describe("the Team label belongs to the Board's own Team only", () => {
  it("reports the author's own Team, so a Member of another Team does not match the Board's", async () => {
    const mine = await setup();
    const other = await setup();
    const insider = await memberOf(mine.teamId, "Olga");
    const outsider = await memberOf(other.teamId, "Mallory");
    await submitComment(ctx.db, insider, ip(), { ideaId: mine.idea.id, body: "Official" });
    await submitComment(ctx.db, outsider, ip(), { ideaId: mine.idea.id, body: "Pretending" });

    const list = await listComments(ctx.db, mine.idea.id);
    const byName = Object.fromEntries(list.map((c) => [c.authorName, c.authorTeamId]));
    expect(byName.Olga).toBe(mine.teamId);
    expect(byName.Mallory).toBe(other.teamId);
    expect(byName.Mallory).not.toBe(mine.teamId);
  });

  it("postingAsFor flags the Team only on the Member's own Team's Board", async () => {
    const mine = await setup();
    const other = await setup();
    const olga = await memberOf(mine.teamId, "Olga");
    expect(postingAsFor(olga, mine.teamId)).toEqual({ name: "Olga", asTeam: true });
    expect(postingAsFor(olga, other.teamId)).toEqual({ name: "Olga", asTeam: false });
    expect(postingAsFor(visitor(), mine.teamId)).toBeNull();
    expect(postingAsFor(null, mine.teamId)).toBeNull();
  });
});

describe("history survives removal (US-3.4, US-5.4)", () => {
  it("keeps the display name and the Team label on past Comments and Ideas", async () => {
    const { teamId, board, idea } = await setup();
    const olga = await memberOf(teamId, "Olga");
    await createMember(ctx.db, { teamId, displayName: "Boss", role: "owner" });
    await submitComment(ctx.db, olga, ip(), { ideaId: idea.id, body: "Before I left" });
    const posted = await submitIdea(ctx.db, olga, ip(), { boardId: board.id, title: "My idea" });
    if (!posted.ok || !posted.ideaId) throw new Error("expected success");

    await softRemoveMember(ctx.db, { teamId, memberId: olga.memberId! });

    const [comment] = await listComments(ctx.db, idea.id);
    expect(comment).toMatchObject({ authorName: "Olga", authorTeamId: teamId });
    expect(await getIdea(ctx.db, posted.ideaId)).toMatchObject({
      authorName: "Olga",
      authorTeamId: teamId,
    });
  });
});

describe("authorNameFor", () => {
  it("uses the Session's name for a Member and the typed name for a Visitor", () => {
    const member: Visitor = {
      anonId: "member:m",
      actorId: "member:m",
      memberId: "m",
      teamId: "t",
      displayName: "Olga",
    };
    expect(authorNameFor(member, "Typed")).toBe("Olga");
    expect(authorNameFor(member, undefined)).toBe("Olga");
    expect(authorNameFor(visitor(), "Typed")).toBe("Typed");
    expect(authorNameFor(visitor(), undefined)).toBeNull();
    expect(authorNameFor(visitor(), null)).toBeNull();
  });
});
