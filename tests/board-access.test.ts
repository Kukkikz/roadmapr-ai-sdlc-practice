import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAccessLink, createBoard, revokeAccessLink } from "@/data";
import { teams } from "@/db/schema";
import { canAccessBoard } from "@/lib/board-access";
import { generateToken, hashToken } from "@/lib/link-token";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let pub: Awaited<ReturnType<typeof createBoard>>;
let priv: Awaited<ReturnType<typeof createBoard>>;
let other: Awaited<ReturnType<typeof createBoard>>;

beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db.insert(teams).values([
    { id: "t1", name: "Acme", slug: "acme" },
    { id: "t2", name: "Other", slug: "other" },
  ]);
  pub = await createBoard(ctx.db, { teamId: "t1", name: "Pub", slug: "pub" });
  priv = await createBoard(ctx.db, {
    teamId: "t1",
    name: "Priv",
    slug: "priv",
    visibility: "private",
  });
  other = await createBoard(ctx.db, {
    teamId: "t1",
    name: "Priv2",
    slug: "priv2",
    visibility: "private",
  });
});
afterAll(async () => {
  await ctx.close();
});

const shareLink = (boardId: string, teamId = "t1") =>
  createAccessLink(ctx.db, {
    teamId,
    boardId,
    kind: "board_share",
    tokenHash: hashToken(generateToken()),
  });

describe("canAccessBoard (G3, US-4.2)", () => {
  it("lets anyone see a Public board", async () => {
    expect(await canAccessBoard(ctx.db, pub)).toBe(true);
    expect(await canAccessBoard(ctx.db, pub, { grants: [] })).toBe(true);
  });

  it("refuses a Private board with no access, an empty cookie or a Member of another Team", async () => {
    expect(await canAccessBoard(ctx.db, priv)).toBe(false);
    expect(await canAccessBoard(ctx.db, priv, { grants: [] })).toBe(false);
    expect(await canAccessBoard(ctx.db, priv, { teamId: "t2", grants: [] })).toBe(false);
  });

  it("lets a signed-in Member of the Board's own Team in without a link", async () => {
    expect(await canAccessBoard(ctx.db, priv, { teamId: "t1", grants: [] })).toBe(true);
  });

  it("lets a Visitor in while the share link they joined with is not revoked", async () => {
    const link = await shareLink(priv.id);
    const access = { grants: [{ boardId: priv.id, linkId: link.id }] };
    expect(await canAccessBoard(ctx.db, priv, access)).toBe(true);
  });

  it("ends access when that link is revoked, which is what rotating does", async () => {
    const link = await shareLink(priv.id);
    const access = { grants: [{ boardId: priv.id, linkId: link.id }] };
    await revokeAccessLink(ctx.db, link.id);
    expect(await canAccessBoard(ctx.db, priv, access)).toBe(false);
  });

  it("refuses a grant whose link does not exist", async () => {
    expect(
      await canAccessBoard(ctx.db, priv, { grants: [{ boardId: priv.id, linkId: "nope" }] }),
    ).toBe(false);
  });

  it("refuses a grant that names another Board's link", async () => {
    const link = await shareLink(other.id);
    expect(
      await canAccessBoard(ctx.db, priv, { grants: [{ boardId: priv.id, linkId: link.id }] }),
    ).toBe(false);
  });

  it("refuses a grant for a different Board than the one asked about", async () => {
    const link = await shareLink(priv.id);
    expect(
      await canAccessBoard(ctx.db, other, { grants: [{ boardId: priv.id, linkId: link.id }] }),
    ).toBe(false);
  });

  it("refuses a link that is not a Board share link", async () => {
    const invite = await createAccessLink(ctx.db, {
      teamId: "t1",
      kind: "member_invite",
      tokenHash: hashToken(generateToken()),
      expiresAt: new Date(Date.now() + 1e6),
    });
    expect(
      await canAccessBoard(ctx.db, priv, { grants: [{ boardId: priv.id, linkId: invite.id }] }),
    ).toBe(false);
  });
});
