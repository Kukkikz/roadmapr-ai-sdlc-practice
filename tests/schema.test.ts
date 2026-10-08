import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  accessLinks,
  boards,
  comments,
  ideaStatusEvents,
  ideaTags,
  ideas,
  members,
  sessions,
  tags,
  teams,
  votes,
} from "@/db/schema";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await ctx.db.delete(teams);
});

/** One Team with an Owner, a Board, an Idea, a Tag and one of each child row. */
async function seedTree() {
  const { db } = ctx;
  await db.insert(teams).values({ id: "t1", name: "Acme", slug: "acme" });
  await db.insert(members).values({ id: "m1", teamId: "t1", displayName: "Ada", role: "owner" });
  await db.insert(boards).values({ id: "b1", teamId: "t1", name: "Product", slug: "product" });
  await db.insert(ideas).values({
    id: "i1",
    boardId: "b1",
    title: "Dark mode",
    description: "Please add a dark theme",
    actorId: "member:m1",
  });
  await db.insert(tags).values({ id: "g1", boardId: "b1", name: "ui", color: "blue" });
  await db.insert(ideaTags).values({ ideaId: "i1", tagId: "g1", boardId: "b1" });
  await db.insert(votes).values({ ideaId: "i1", actorId: "anon:c1" });
  await db.insert(comments).values({ id: "c1", ideaId: "i1", body: "+1", actorId: "anon:c1" });
  await db.insert(ideaStatusEvents).values({
    id: "e1",
    ideaId: "i1",
    actorId: "member:m1",
    fromStatus: "open",
    toStatus: "planned",
  });
  await db.insert(accessLinks).values([
    { id: "l1", teamId: "t1", memberId: "m1", kind: "owner", tokenHash: "h-owner" },
    { id: "l2", teamId: "t1", boardId: "b1", kind: "board_share", tokenHash: "h-share" },
  ]);
  await db
    .insert(sessions)
    .values({ tokenHash: "s1", memberId: "m1", expiresAt: new Date(Date.now() + 1000) });
}

async function count(table: PgTable) {
  const rows = await ctx.db.select().from(table);
  return rows.length;
}

describe("full-text search column", () => {
  it("generates a tsvector that matches stemmed words in title and description", async () => {
    await seedTree();
    const match = (q: string) =>
      ctx.db
        .select({ id: ideas.id })
        .from(ideas)
        .where(sql`${ideas.search} @@ plainto_tsquery('english', ${q})`);
    expect(await match("themes")).toHaveLength(1);
    expect(await match("dark")).toHaveLength(1);
    expect(await match("billing")).toHaveLength(0);
  });
});

describe("cascade deletes", () => {
  it("deleting a Team removes everything below it", async () => {
    await seedTree();
    await ctx.db.delete(teams).where(eq(teams.id, "t1"));
    for (const table of [
      members,
      boards,
      ideas,
      tags,
      ideaTags,
      votes,
      comments,
      ideaStatusEvents,
      accessLinks,
      sessions,
    ]) {
      expect(await count(table)).toBe(0);
    }
  });

  it("deleting a Board removes its Ideas, Tags and share links but keeps the Team and Owner link", async () => {
    await seedTree();
    await ctx.db.delete(boards).where(eq(boards.id, "b1"));
    for (const table of [ideas, tags, ideaTags, votes, comments, ideaStatusEvents]) {
      expect(await count(table)).toBe(0);
    }
    const links = await ctx.db.select().from(accessLinks);
    expect(links.map((l) => l.kind)).toEqual(["owner"]);
    expect(await count(teams)).toBe(1);
    expect(await count(members)).toBe(1);
  });

  it("deleting an Idea removes its votes, comments, history and tag links but not the Tag", async () => {
    await seedTree();
    await ctx.db.delete(ideas).where(eq(ideas.id, "i1"));
    for (const table of [votes, comments, ideaStatusEvents, ideaTags]) {
      expect(await count(table)).toBe(0);
    }
    expect(await count(tags)).toBe(1);
  });

  it("deleting a Tag removes only its idea_tags rows", async () => {
    await seedTree();
    await ctx.db.delete(tags).where(eq(tags.id, "g1"));
    expect(await count(ideaTags)).toBe(0);
    expect(await count(ideas)).toBe(1);
  });

  it("deleting a Member row removes its sessions and Owner link", async () => {
    await seedTree();
    await ctx.db.delete(members).where(eq(members.id, "m1"));
    expect(await count(sessions)).toBe(0);
    const links = await ctx.db.select().from(accessLinks);
    expect(links.map((l) => l.kind)).toEqual(["board_share"]);
  });
});

describe("member soft removal", () => {
  it("keeps the row so Ideas and Comments still resolve the author's name", async () => {
    await seedTree();
    await ctx.db.update(members).set({ removedAt: new Date() }).where(eq(members.id, "m1"));
    const [row] = await ctx.db
      .select({ title: ideas.title, name: members.displayName, removedAt: members.removedAt })
      .from(ideas)
      .innerJoin(members, sql`${ideas.actorId} = 'member:' || ${members.id}`);
    expect(row).toMatchObject({ title: "Dark mode", name: "Ada" });
    expect(row.removedAt).toBeInstanceOf(Date);
  });
});

describe("constraints", () => {
  beforeEach(seedTree);

  it("rejects an actor_id that is neither anon: nor member:", async () => {
    const bad = "someone";
    await expect(
      ctx.db.insert(ideas).values({ id: "i2", boardId: "b1", title: "x", actorId: bad }),
    ).rejects.toThrow();
    await expect(ctx.db.insert(votes).values({ ideaId: "i1", actorId: bad })).rejects.toThrow();
    await expect(
      ctx.db.insert(comments).values({ id: "c2", ideaId: "i1", body: "x", actorId: bad }),
    ).rejects.toThrow();
    await expect(
      ctx.db.insert(ideaStatusEvents).values({
        id: "e2",
        ideaId: "i1",
        actorId: bad,
        fromStatus: "open",
        toStatus: "planned",
      }),
    ).rejects.toThrow();
  });

  it("accepts both actor_id shapes", async () => {
    await ctx.db.insert(votes).values({ ideaId: "i1", actorId: "member:m1" });
    expect(await count(votes)).toBe(2);
  });

  it("allows one vote per actor per idea", async () => {
    await expect(
      ctx.db.insert(votes).values({ ideaId: "i1", actorId: "anon:c1" }),
    ).rejects.toThrow();
  });

  it("rejects unknown status, role, visibility and link kind", async () => {
    await expect(
      ctx.db
        .update(ideas)
        .set({ status: "bogus" as never })
        .where(eq(ideas.id, "i1")),
    ).rejects.toThrow();
    await expect(
      ctx.db
        .insert(members)
        .values({ id: "m2", teamId: "t1", displayName: "Bo", role: "admin" as never }),
    ).rejects.toThrow();
    await expect(
      ctx.db.insert(boards).values({
        id: "b2",
        teamId: "t1",
        name: "X",
        slug: "x",
        visibility: "secret" as never,
      }),
    ).rejects.toThrow();
    await expect(
      ctx.db
        .insert(accessLinks)
        .values({ id: "l9", teamId: "t1", kind: "bogus" as never, tokenHash: "h9" }),
    ).rejects.toThrow();
  });

  it("enforces access link shape per kind", async () => {
    const link = (v: Partial<typeof accessLinks.$inferInsert>) =>
      ctx.db.insert(accessLinks).values({
        id: `l-${Math.random()}`,
        teamId: "t1",
        tokenHash: `h-${Math.random()}`,
        kind: "member_invite",
        ...v,
      });
    await expect(link({ kind: "owner" })).rejects.toThrow(); // needs member
    await expect(link({ kind: "owner", memberId: "m1", boardId: "b1" })).rejects.toThrow();
    await expect(link({ kind: "member_invite", memberId: "m1" })).rejects.toThrow();
    await expect(link({ kind: "member_invite", boardId: "b1" })).rejects.toThrow();
    await expect(link({ kind: "board_share" })).rejects.toThrow(); // needs board
    await expect(link({ kind: "board_share", boardId: "b1", memberId: "m1" })).rejects.toThrow();
    await expect(link({ kind: "member_invite" })).resolves.toBeDefined();
  });

  it("requires unique token hashes", async () => {
    await expect(
      ctx.db
        .insert(accessLinks)
        .values({ id: "l3", teamId: "t1", kind: "member_invite", tokenHash: "h-owner" }),
    ).rejects.toThrow();
  });

  it("scopes board slugs and tag names to their parent", async () => {
    await expect(
      ctx.db.insert(boards).values({ id: "b2", teamId: "t1", name: "Dup", slug: "product" }),
    ).rejects.toThrow();
    await ctx.db.insert(teams).values({ id: "t2", name: "Other", slug: "other" });
    await expect(
      ctx.db.insert(boards).values({ id: "b3", teamId: "t2", name: "Same", slug: "product" }),
    ).resolves.toBeDefined();
    await expect(
      ctx.db.insert(tags).values({ id: "g2", boardId: "b1", name: "ui", color: "red" }),
    ).rejects.toThrow();
  });

  it("only lets a Tag be applied to an Idea on the same Board", async () => {
    await ctx.db.insert(boards).values({ id: "b2", teamId: "t1", name: "Other", slug: "other" });
    await ctx.db.insert(tags).values({ id: "g2", boardId: "b2", name: "api", color: "red" });
    // tag g2 belongs to b2, idea i1 to b1: no board_id satisfies both foreign keys
    await expect(
      ctx.db.insert(ideaTags).values({ ideaId: "i1", tagId: "g2", boardId: "b1" }),
    ).rejects.toThrow();
    await expect(
      ctx.db.insert(ideaTags).values({ ideaId: "i1", tagId: "g2", boardId: "b2" }),
    ).rejects.toThrow();
  });
});
