import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMember, createSession, findSessionByHash } from "@/data";
import { teams } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/link-token";
import { createTestDb } from "./helpers/db";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock("next/server", () => ({ connection: async () => {} }));

let ctx: Awaited<ReturnType<typeof createTestDb>>;
vi.mock("@/db", () => ({ getDb: () => ctx.db }));

const { SESSION_COOKIE, getSession } = await import("@/lib/session");
const { signOut } = await import("@/lib/sign-out");

beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db.insert(teams).values({ id: "t1", name: "Acme", slug: "acme" });
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(() => jar.clear());

async function signedIn() {
  const member = await createMember(ctx.db, { teamId: "t1", displayName: "Ada", role: "owner" });
  const token = generateToken();
  await createSession(ctx.db, {
    tokenHash: hashToken(token),
    memberId: member.id,
    expiresAt: new Date(Date.now() + 60_000),
  });
  jar.set(SESSION_COOKIE, token);
  return token;
}

describe("signOut (US-3.5)", () => {
  it("deletes the Session on the server and clears the cookie", async () => {
    const token = await signedIn();
    expect(await getSession()).not.toBeNull();
    await signOut(ctx.db);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    expect(await findSessionByHash(ctx.db, hashToken(token))).toBeNull();
  });

  it("makes a copied cookie useless afterwards (server-side, not just cookie removal)", async () => {
    const token = await signedIn();
    await signOut(ctx.db);
    jar.set(SESSION_COOKIE, token);
    expect(await getSession()).toBeNull();
  });

  it("leaves other devices' Sessions of the same Member alone", async () => {
    const first = await signedIn();
    const memberId = (await findSessionByHash(ctx.db, hashToken(first)))!.member.id;
    const other = generateToken();
    await createSession(ctx.db, {
      tokenHash: hashToken(other),
      memberId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await signOut(ctx.db);
    expect(await findSessionByHash(ctx.db, hashToken(other))).not.toBeNull();
  });

  it("is harmless when nobody is signed in or the cookie is junk", async () => {
    await expect(signOut(ctx.db)).resolves.toBeUndefined();
    jar.set(SESSION_COOKIE, "junk");
    await expect(signOut(ctx.db)).resolves.toBeUndefined();
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });
});
