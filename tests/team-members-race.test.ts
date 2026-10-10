import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMember, createSession, findActiveMember } from "@/data";
import { teams } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/link-token";
import { createTestDb } from "./helpers/db";

// Two Owners removing each other at the same instant can both pass the one-statement guard on a
// driver without transactions. Simulate the second check seeing the other removal: no Owners.
vi.mock("@/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data")>();
  return { ...actual, countActiveOwners: vi.fn(async () => 0) };
});

const { removeTeamMember } = await import("@/lib/team-members");
const { findSessionByHash } = await import("@/data");

let ctx: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db.insert(teams).values({ id: "t1", name: "Acme", slug: "acme" });
});
afterAll(async () => {
  await ctx.close();
});

describe("removing an Owner that left no Owner behind", () => {
  it("puts them back and keeps their Sessions", async () => {
    const ada = await createMember(ctx.db, { teamId: "t1", displayName: "Ada", role: "owner" });
    await createMember(ctx.db, { teamId: "t1", displayName: "Bea", role: "owner" });
    const token = generateToken();
    await createSession(ctx.db, {
      tokenHash: hashToken(token),
      memberId: ada.id,
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(await removeTeamMember(ctx.db, "t1", ada.id)).toBe("last_owner");
    expect(await findActiveMember(ctx.db, "t1", ada.id)).not.toBeNull();
    expect(await findSessionByHash(ctx.db, hashToken(token))).not.toBeNull();
  });
});
