import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addVote,
  countVotes,
  createBoard,
  createIdea,
  hasVoted,
  setIdeaHidden,
  setIdeaStatus,
  votedIdeaIds,
} from "@/data";
import type { IdeaStatus } from "@/db/schema";
import { teams } from "@/db/schema";
import { castVote } from "@/lib/cast-vote";
import type { Visitor } from "@/lib/visitor";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let publicBoard: string;
let privateBoard: string;

beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db.insert(teams).values({ id: "t1", name: "Acme", slug: "acme" });
  publicBoard = (await createBoard(ctx.db, { teamId: "t1", name: "Pub", slug: "pub" })).id;
  privateBoard = (
    await createBoard(ctx.db, { teamId: "t1", name: "Priv", slug: "priv", visibility: "private" })
  ).id;
});

afterAll(async () => {
  await ctx.close();
});

// ~60 sequential votes: fast on a local Postgres, slow over the internet (Neon).
const SLOW = 120_000;

const NOW = new Date("2026-03-01T12:00:00Z");
let counter = 0;
const visitor = (): Visitor => {
  const anonId = `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
  return { anonId, actorId: `anon:${anonId}` };
};
const newIdea = (boardId = publicBoard) =>
  createIdea(ctx.db, { boardId, title: "Idea", actorId: "anon:author" });

describe("castVote", () => {
  it("adds a vote, then takes it back on the second call (toggle)", async () => {
    const idea = await newIdea();
    const me = visitor();
    expect(await castVote(ctx.db, me, "192.0.2.1", idea.id, NOW)).toEqual({
      ok: true,
      voted: true,
      voteCount: 1,
    });
    expect(await hasVoted(ctx.db, idea.id, me.actorId)).toBe(true);
    expect(await castVote(ctx.db, me, "192.0.2.1", idea.id, NOW)).toEqual({
      ok: true,
      voted: false,
      voteCount: 0,
    });
    expect(await hasVoted(ctx.db, idea.id, me.actorId)).toBe(false);
  });

  it("counts one vote per Actor and many Actors separately", async () => {
    const idea = await newIdea();
    const a = visitor();
    const b = visitor();
    await castVote(ctx.db, a, "192.0.2.2", idea.id, NOW);
    const result = await castVote(ctx.db, b, "192.0.2.3", idea.id, NOW);
    expect(result).toMatchObject({ ok: true, voted: true, voteCount: 2 });
    expect(await countVotes(ctx.db, idea.id)).toBe(2);
  });

  it("never leaves two votes for one Actor, even with concurrent requests", async () => {
    const idea = await newIdea();
    const me = visitor();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => castVote(ctx.db, me, "192.0.2.4", idea.id, NOW)),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await countVotes(ctx.db, idea.id)).toBeLessThanOrEqual(1);
  });

  it.each<IdeaStatus>(["open", "planned", "in_progress", "shipped", "declined"])(
    "allows voting on an Idea with status %s",
    async (status) => {
      const idea = await newIdea();
      if (status !== "open") await setIdeaStatus(ctx.db, idea.id, status, "member:m1");
      const result = await castVote(ctx.db, visitor(), "192.0.2.5", idea.id, NOW);
      expect(result).toMatchObject({ ok: true, voted: true });
    },
  );

  it("answers not found for a hidden Idea and leaves votes unchanged (G2)", async () => {
    const idea = await newIdea();
    await addVote(ctx.db, idea.id, "anon:earlier");
    await setIdeaHidden(ctx.db, idea.id, true);
    expect(await castVote(ctx.db, visitor(), "192.0.2.6", idea.id, NOW)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await countVotes(ctx.db, idea.id)).toBe(1);
  });

  it("answers not found for an Idea on a Private board or a missing Idea (G3)", async () => {
    const hiddenAway = await newIdea(privateBoard);
    expect(await castVote(ctx.db, visitor(), "192.0.2.7", hiddenAway.id, NOW)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await countVotes(ctx.db, hiddenAway.id)).toBe(0);
    expect(await castVote(ctx.db, visitor(), "192.0.2.7", "missing", NOW)).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it(
    "refuses the 61st vote from one IP in a minute and changes nothing",
    async () => {
      const idea = await newIdea();
      const ip = "198.51.100.61";
      for (let i = 0; i < 60; i++) {
        const other = await newIdea();
        expect((await castVote(ctx.db, visitor(), ip, other.id, NOW)).ok).toBe(true);
      }
      const refused = await castVote(ctx.db, visitor(), ip, idea.id, NOW);
      expect(refused).toEqual({ ok: false, error: "rate_limited" });
      expect(await countVotes(ctx.db, idea.id)).toBe(0);
    },
    SLOW,
  );

  it(
    "limits per IP, not per cookie: a fresh cookie does not reset the limit",
    async () => {
      const ip = "198.51.100.62";
      for (let i = 0; i < 60; i++) {
        await castVote(ctx.db, visitor(), ip, (await newIdea()).id, NOW);
      }
      const result = await castVote(ctx.db, visitor(), ip, (await newIdea()).id, NOW);
      expect(result).toEqual({ ok: false, error: "rate_limited" });
    },
    SLOW,
  );

  it(
    "allows votes again in the next minute",
    async () => {
      const ip = "198.51.100.63";
      for (let i = 0; i < 61; i++) {
        await castVote(ctx.db, visitor(), ip, (await newIdea()).id, NOW);
      }
      const later = new Date(NOW.getTime() + 61_000);
      expect((await castVote(ctx.db, visitor(), ip, (await newIdea()).id, later)).ok).toBe(true);
    },
    SLOW,
  );
});

describe("votedIdeaIds", () => {
  it("returns only the Ideas this Actor voted for, in one query", async () => {
    const a = await newIdea();
    const b = await newIdea();
    const c = await newIdea();
    const me = visitor();
    await addVote(ctx.db, a.id, me.actorId);
    await addVote(ctx.db, c.id, me.actorId);
    await addVote(ctx.db, b.id, "anon:someone-else");
    const voted = await votedIdeaIds(ctx.db, me.actorId, [a.id, b.id, c.id]);
    expect([...voted].sort()).toEqual([a.id, c.id].sort());
  });

  it("returns an empty set for no Ideas without querying", async () => {
    expect((await votedIdeaIds(ctx.db, "anon:x", [])).size).toBe(0);
  });
});
