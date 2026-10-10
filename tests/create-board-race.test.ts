import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { teams } from "@/db/schema";
import { createTestDb } from "./helpers/db";

// Two Owners (or two tabs) creating the same slug at once: both pass the pre-check, and the
// unique index (team_id, slug) refuses the second insert. Simulate that by making `createBoard`
// throw after the pre-check, with or without the competing Board existing by then.
const behaviour = vi.hoisted(() => ({ competitor: false }));
vi.mock("@/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data")>();
  return {
    ...actual,
    createBoard: vi.fn(
      async (
        db: Parameters<typeof actual.createBoard>[0],
        input: Parameters<typeof actual.createBoard>[1],
      ) => {
        if (behaviour.competitor) await actual.createBoard(db, { ...input, name: "Winner" });
        throw new Error("unique violation");
      },
    ),
  };
});

const { createBoardForTeam } = await import("@/lib/create-board");

let ctx: Awaited<ReturnType<typeof createTestDb>>;
const team = { id: "t1", name: "Acme", slug: "acme" };

beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db.insert(teams).values(team);
});
afterAll(async () => {
  await ctx.close();
});

describe("createBoardForTeam when the insert loses a race", () => {
  it("turns a unique violation caused by a competing Board into the 'taken' field error", async () => {
    behaviour.competitor = true;
    const result = await createBoardForTeam(ctx.db, team, { name: "Mine", slug: "contested" });
    expect(result).toMatchObject({ ok: false, error: "invalid" });
    if (result.ok || result.error !== "invalid") throw new Error("expected invalid");
    expect(result.fieldErrors.slug).toMatch(/taken/);
  });

  it("rethrows any other insert failure instead of calling it 'taken'", async () => {
    behaviour.competitor = false;
    await expect(
      createBoardForTeam(ctx.db, team, { name: "Mine", slug: "free-slug" }),
    ).rejects.toThrow("unique violation");
  });
});
