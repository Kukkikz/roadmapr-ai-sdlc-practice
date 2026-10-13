import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createBoard,
  createIdea,
  createTag,
  getIdea,
  listUnreviewedIdeas,
  markIdeaReviewed,
} from "@/data";
import { ideas, teams } from "@/db/schema";
import { changeIdeaStatus } from "@/lib/change-status";
import { moderateIdea } from "@/lib/moderate";
import { setIdeaTags } from "@/lib/set-idea-tags";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

async function setup() {
  const n = ++counter;
  const team = { id: `team-${n}`, name: `Team ${n}`, slug: `team-${n}` };
  await ctx.db.insert(teams).values(team);
  const board = await createBoard(ctx.db, { teamId: team.id, name: "B", slug: "b" });
  const idea = await createIdea(ctx.db, { boardId: board.id, title: "Idea", actorId: "anon:a" });
  return { team, board, idea };
}
const queueIds = async (teamId: string) =>
  (await listUnreviewedIdeas(ctx.db, teamId)).map((i) => i.id);
const reviewedAt = async (id: string) =>
  (await getIdea(ctx.db, id, { includeHidden: true }))?.reviewedAt;

describe("moderation queue (US-5.5)", () => {
  it("lists a Team's unreviewed Ideas, newest first, across its Boards, and no other Team's", async () => {
    const { team, board, idea } = await setup();
    const other = await createBoard(ctx.db, { teamId: team.id, name: "C", slug: "c" });
    const newer = await createIdea(ctx.db, {
      boardId: other.id,
      title: "Newer",
      actorId: "anon:b",
    });
    await ctx.db
      .update(ideas)
      .set({ createdAt: new Date(Date.now() + 60_000) })
      .where(eq(ideas.id, newer.id));
    const foreign = await setup();
    expect(await queueIds(team.id)).toEqual([newer.id, idea.id]);
    expect(await queueIds(foreign.team.id)).toEqual([foreign.idea.id]);
    expect(board.id).toBeTruthy();
  });

  it("includes hidden Ideas", async () => {
    const { team, idea } = await setup();
    await ctx.db.update(ideas).set({ hidden: true }).where(eq(ideas.id, idea.id));
    expect(await queueIds(team.id)).toEqual([idea.id]);
  });

  it("markIdeaReviewed sets reviewed_at once and keeps the first time", async () => {
    const { team, idea } = await setup();
    expect(await reviewedAt(idea.id)).toBeNull();
    await markIdeaReviewed(ctx.db, idea.id);
    const first = await reviewedAt(idea.id);
    expect(first).toBeInstanceOf(Date);
    await markIdeaReviewed(ctx.db, idea.id);
    expect((await reviewedAt(idea.id))?.getTime()).toBe(first?.getTime());
    expect(await queueIds(team.id)).toEqual([]);
  });

  it("changing status takes the Idea off the queue, an invalid status does not", async () => {
    const { team, idea } = await setup();
    expect(await changeIdeaStatus(ctx.db, team.id, "member:m", idea.id, "bogus")).toBe("invalid");
    expect(await reviewedAt(idea.id)).toBeNull();
    await changeIdeaStatus(ctx.db, team.id, "member:m", idea.id, "planned");
    expect(await reviewedAt(idea.id)).toBeInstanceOf(Date);
  });

  it("tagging takes the Idea off the queue, a refused save does not", async () => {
    const { team, board, idea } = await setup();
    expect(await setIdeaTags(ctx.db, team.id, idea.id, ["nope"])).toBe("invalid");
    expect(await reviewedAt(idea.id)).toBeNull();
    const tag = await createTag(ctx.db, { boardId: board.id, name: "ui", color: "blue" });
    await setIdeaTags(ctx.db, team.id, idea.id, [tag.id]);
    expect(await reviewedAt(idea.id)).toBeInstanceOf(Date);
  });

  it("hiding takes the Idea off the queue; another Team's attempt does not", async () => {
    const mine = await setup();
    const theirs = await setup();
    await moderateIdea(ctx.db, mine.team.id, theirs.idea.id, true);
    await changeIdeaStatus(ctx.db, mine.team.id, "member:m", theirs.idea.id, "planned");
    await setIdeaTags(ctx.db, mine.team.id, theirs.idea.id, []);
    expect(await reviewedAt(theirs.idea.id)).toBeNull();
    await moderateIdea(ctx.db, mine.team.id, mine.idea.id, true);
    expect(await reviewedAt(mine.idea.id)).toBeInstanceOf(Date);
  });
});
