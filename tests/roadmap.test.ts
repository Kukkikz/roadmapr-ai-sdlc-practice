import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addVote,
  createBoard,
  createIdea,
  listRoadmapIdeas,
  setIdeaHidden,
  setIdeaStatus,
} from "@/data";
import type { IdeaStatus } from "@/db/schema";
import { teams } from "@/db/schema";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let boardId: string;

beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db.insert(teams).values({ id: "t1", name: "Acme", slug: "acme" });
  boardId = (await createBoard(ctx.db, { teamId: "t1", name: "Product", slug: "product" })).id;
});

afterAll(async () => {
  await ctx.close();
});

async function ideaWithStatus(title: string, status: IdeaStatus, votes = 0) {
  const idea = await createIdea(ctx.db, { boardId, title, actorId: "anon:a" });
  if (status !== "open") await setIdeaStatus(ctx.db, idea.id, status, "member:m1");
  for (let i = 0; i < votes; i++) await addVote(ctx.db, idea.id, `anon:v${i}`);
  return idea;
}

describe("listRoadmapIdeas", () => {
  it("groups planned, in progress and shipped, most voted first, and leaves out open and declined", async () => {
    await ideaWithStatus("Open one", "open", 5);
    await ideaWithStatus("Declined one", "declined", 5);
    await ideaWithStatus("Planned low", "planned", 1);
    await ideaWithStatus("Planned high", "planned", 3);
    await ideaWithStatus("Doing", "in_progress");
    await ideaWithStatus("Done", "shipped");

    const roadmap = await listRoadmapIdeas(ctx.db, boardId);
    expect(roadmap.planned.map((i) => i.title)).toEqual(["Planned high", "Planned low"]);
    expect(roadmap.in_progress.map((i) => i.title)).toEqual(["Doing"]);
    expect(roadmap.shipped.map((i) => i.title)).toEqual(["Done"]);
    expect(roadmap.planned[0].voteCount).toBe(3);
  });

  it("does not show hidden Ideas (G2)", async () => {
    const hidden = await ideaWithStatus("Hidden shipped", "shipped");
    await setIdeaHidden(ctx.db, hidden.id, true);
    const roadmap = await listRoadmapIdeas(ctx.db, boardId);
    expect(roadmap.shipped.map((i) => i.title)).not.toContain("Hidden shipped");
  });
});
