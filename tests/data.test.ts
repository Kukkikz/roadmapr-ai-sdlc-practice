import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  addComment,
  addVote,
  assignTag,
  createBoard,
  createIdea,
  createTag,
  deleteTag,
  getBoardBySlugs,
  getIdea,
  hasVoted,
  listBoardsForTeam,
  listComments,
  listIdeas,
  listStatusEvents,
  listTags,
  removeTag,
  removeVote,
  setCommentHidden,
  setIdeaHidden,
  setIdeaStatus,
  toggleVote,
} from "@/data";
import { ideas, teams } from "@/db/schema";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let boardId: string;
let otherBoardId: string;

beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db.insert(teams).values({ id: "t1", name: "Acme", slug: "acme" });
  boardId = (await createBoard(ctx.db, { teamId: "t1", name: "Product", slug: "product" })).id;
  otherBoardId = (await createBoard(ctx.db, { teamId: "t1", name: "Beta", slug: "beta" })).id;
});

afterAll(async () => {
  await ctx.close();
});

const idea = (title: string) => createIdea(ctx.db, { boardId, title, actorId: "anon:a" });

describe("boards", () => {
  it("resolves a Board from team and board slugs and lists a Team's Boards", async () => {
    const found = await getBoardBySlugs(ctx.db, "acme", "product");
    expect(found?.board.id).toBe(boardId);
    expect(found?.team.slug).toBe("acme");
    expect(await getBoardBySlugs(ctx.db, "acme", "nope")).toBeNull();
    const slugs = (await listBoardsForTeam(ctx.db, "t1")).map((b) => b.slug);
    expect(slugs).toContain("product");
    expect(slugs).toContain("beta");
  });
});

describe("votes", () => {
  it("toggles and stays idempotent", async () => {
    const i = await idea("Vote target");
    expect(await toggleVote(ctx.db, i.id, "anon:v1")).toBe(true);
    expect(await hasVoted(ctx.db, i.id, "anon:v1")).toBe(true);
    await addVote(ctx.db, i.id, "anon:v1");
    expect((await getIdea(ctx.db, i.id))?.voteCount).toBe(1);
    expect(await toggleVote(ctx.db, i.id, "anon:v1")).toBe(false);
    expect((await getIdea(ctx.db, i.id))?.voteCount).toBe(0);
    await removeVote(ctx.db, i.id, "anon:v1");
  });
});

describe("comments", () => {
  it("hides instead of deleting and counts only visible ones", async () => {
    const i = await idea("Comment target");
    const c1 = await addComment(ctx.db, { ideaId: i.id, body: "first", actorId: "anon:a" });
    await addComment(ctx.db, { ideaId: i.id, body: "second", actorId: "anon:b" });
    await setCommentHidden(ctx.db, c1.id, true);
    expect((await listComments(ctx.db, i.id)).map((c) => c.body)).toEqual(["second"]);
    expect(await listComments(ctx.db, i.id, { includeHidden: true })).toHaveLength(2);
    expect((await getIdea(ctx.db, i.id))?.commentCount).toBe(1);
    expect((await getIdea(ctx.db, i.id, { includeHidden: true }))?.commentCount).toBe(2);
  });
});

describe("tags", () => {
  it("assigns, removes and cascades on delete; rejects other Boards' Tags", async () => {
    const i = await idea("Tag target");
    const t = await createTag(ctx.db, { boardId, name: "tag-a", color: "red" });
    const foreign = await createTag(ctx.db, { boardId: otherBoardId, name: "tag-b", color: "red" });
    await assignTag(ctx.db, i.id, t.id);
    await assignTag(ctx.db, i.id, t.id); // idempotent
    expect((await getIdea(ctx.db, i.id))?.tags.map((x) => x.name)).toEqual(["tag-a"]);
    await expect(assignTag(ctx.db, i.id, foreign.id)).rejects.toThrow();
    await expect(assignTag(ctx.db, "missing", t.id)).rejects.toThrow("Idea not found");
    await removeTag(ctx.db, i.id, t.id);
    expect((await getIdea(ctx.db, i.id))?.tags).toEqual([]);
    await assignTag(ctx.db, i.id, t.id);
    await deleteTag(ctx.db, t.id);
    expect((await getIdea(ctx.db, i.id))?.tags).toEqual([]);
    expect((await listTags(ctx.db, boardId)).map((x) => x.name)).not.toContain("tag-a");
  });
});

describe("getIdea", () => {
  it("hides hidden Ideas from the public and does not resolve across Boards", async () => {
    const i = await idea("Scoped target");
    expect(await getIdea(ctx.db, i.id, { boardId })).not.toBeNull();
    expect(await getIdea(ctx.db, i.id, { boardId: otherBoardId })).toBeNull();
    await setIdeaHidden(ctx.db, i.id, true);
    expect(await getIdea(ctx.db, i.id, { boardId })).toBeNull();
    expect(await getIdea(ctx.db, i.id, { boardId, includeHidden: true })).not.toBeNull();
  });
});

describe("status", () => {
  it("records history, allows any transition and ignores no-ops", async () => {
    const i = await idea("Status target");
    expect(await setIdeaStatus(ctx.db, i.id, "shipped", "member:m1")).toBe(true);
    expect(await setIdeaStatus(ctx.db, i.id, "shipped", "member:m1")).toBe(false);
    expect(await setIdeaStatus(ctx.db, i.id, "open", "member:m1")).toBe(true);
    expect(await setIdeaStatus(ctx.db, "missing", "open", "member:m1")).toBe(false);
    const events = await listStatusEvents(ctx.db, i.id);
    expect(events.map((e) => [e.fromStatus, e.toStatus])).toEqual([
      ["open", "shipped"],
      ["shipped", "open"],
    ]);
    expect((await getIdea(ctx.db, i.id))?.status).toBe("open");
  });
});

describe("listIdeas", () => {
  let listBoard: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    listBoard = (await createBoard(ctx.db, { teamId: "t1", name: "List", slug: "list" })).id;
    const mk = async (key: string, title: string, description: string, createdAt: Date) => {
      const row = await createIdea(ctx.db, {
        boardId: listBoard,
        title,
        description,
        actorId: "anon:a",
      });
      ids[key] = row.id;
      await ctx.db.update(ideas).set({ createdAt }).where(eq(ideas.id, row.id));
    };
    await mk("old", "Old popular", "calendar sync", new Date("2026-01-01"));
    await mk("mid", "Middle", "export to csv", new Date("2026-02-01"));
    await mk("new", "Newest", "dark theme", new Date("2026-03-01"));
    await mk("hid", "Hidden one", "calendar", new Date("2026-04-01"));
    await addVote(ctx.db, ids.old, "anon:1");
    await addVote(ctx.db, ids.old, "anon:2");
    await addVote(ctx.db, ids.mid, "anon:1");
    await setIdeaHidden(ctx.db, ids.hid, true);
    await setIdeaStatus(ctx.db, ids.mid, "planned", "member:m1");
    const tag = await createTag(ctx.db, { boardId: listBoard, name: "ui", color: "blue" });
    await assignTag(ctx.db, ids.new, tag.id);
    ids.tag = tag.id;
  });

  const titles = async (o: Partial<Parameters<typeof listIdeas>[1]> = {}) =>
    (await listIdeas(ctx.db, { boardId: listBoard, ...o })).map((r) => r.title);

  it("sorts by top (votes, then newest) by default and by newest on request", async () => {
    expect(await titles()).toEqual(["Old popular", "Middle", "Newest"]);
    expect(await titles({ sort: "newest" })).toEqual(["Newest", "Middle", "Old popular"]);
  });

  it("hides hidden Ideas from the public but not moderators", async () => {
    expect(await titles({ includeHidden: true })).toContain("Hidden one");
    expect(await titles()).not.toContain("Hidden one");
  });

  it("filters by status and tag", async () => {
    expect(await titles({ status: "planned" })).toEqual(["Middle"]);
    expect(await titles({ tagId: ids.tag })).toEqual(["Newest"]);
  });

  it("searches title and description with stemming", async () => {
    expect(await titles({ search: "calendars" })).toEqual(["Old popular"]);
    expect(await titles({ search: "theme" })).toEqual(["Newest"]);
    expect(await titles({ search: "nothing matches" })).toEqual([]);
    expect(await titles({ search: "   " })).toHaveLength(3);
  });

  it("pages stably when Ideas tie on votes and time", async () => {
    const tieBoard = (await createBoard(ctx.db, { teamId: "t1", name: "Tie", slug: "tie" })).id;
    const same = new Date("2026-05-01");
    for (const n of [1, 2, 3, 4]) {
      const row = await createIdea(ctx.db, {
        boardId: tieBoard,
        title: `T${n}`,
        actorId: "anon:a",
      });
      await ctx.db.update(ideas).set({ createdAt: same }).where(eq(ideas.id, row.id));
    }
    const pages = [];
    for (const offset of [0, 1, 2, 3]) {
      pages.push(...(await listIdeas(ctx.db, { boardId: tieBoard, limit: 1, offset })));
    }
    expect(new Set(pages.map((p) => p.id)).size).toBe(4);
  });

  it("returns counts and tags with each row, and pages", async () => {
    const rows = await listIdeas(ctx.db, { boardId: listBoard });
    expect(rows.map((r) => r.voteCount)).toEqual([2, 1, 0]);
    expect(rows.find((r) => r.title === "Newest")?.tags.map((t) => t.name)).toEqual(["ui"]);
    expect(await titles({ limit: 1, offset: 1 })).toEqual(["Middle"]);
  });
});
