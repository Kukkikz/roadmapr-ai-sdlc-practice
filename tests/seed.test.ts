import { afterAll, beforeAll, expect, it } from "vitest";
import { getBoardBySlugs, listIdeas } from "@/data";
import { seed } from "@/db/seed";
import { ideaStatusEvents } from "@/db/schema";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.close();
});

it("seeds a Team with two Boards and sample Ideas", async () => {
  await seed(ctx.db);
  const product = await getBoardBySlugs(ctx.db, "acme", "product");
  const beta = await getBoardBySlugs(ctx.db, "acme", "beta");
  expect(product?.board.visibility).toBe("public");
  expect(beta?.board.visibility).toBe("private");
  const ideas = await listIdeas(ctx.db, { boardId: product!.board.id });
  expect(ideas.map((i) => i.title)).toEqual([
    "Dark mode",
    "Public API",
    "CSV export",
    "Slack notifications",
  ]);
  expect(ideas[0]).toMatchObject({ voteCount: 3, status: "planned", commentCount: 2 });
  expect(await ctx.db.select().from(ideaStatusEvents)).toHaveLength(1);
});
