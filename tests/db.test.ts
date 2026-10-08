import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { teams } from "@/db/schema";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.close();
});

describe("database (migrations applied to a real Postgres engine)", () => {
  it("inserts and reads back a team", async () => {
    await ctx.db.insert(teams).values({ id: "t1", name: "Acme", slug: "acme" });
    const [row] = await ctx.db.select().from(teams).where(eq(teams.slug, "acme"));
    expect(row).toMatchObject({ id: "t1", name: "Acme", slug: "acme" });
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("enforces a unique team slug", async () => {
    await ctx.db.insert(teams).values({ id: "t2", name: "Beta", slug: "beta" });
    await expect(
      ctx.db.insert(teams).values({ id: "t3", name: "Beta 2", slug: "beta" }),
    ).rejects.toThrow();
  });
});
