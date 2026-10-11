import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBoard, findAccessLinkById, findActiveBoardShareLink } from "@/data";
import { accessLinks, teams } from "@/db/schema";
import { canAccessBoard } from "@/lib/board-access";
import {
  hasActiveShareLink,
  joinBoardWithLink,
  previewBoardLink,
  rotateBoardShareLink,
} from "@/lib/board-share-links";
import { hashToken } from "@/lib/link-token";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;

beforeAll(async () => {
  ctx = await createTestDb();
  await ctx.db.insert(teams).values([
    { id: "t1", name: "Acme", slug: "acme" },
    { id: "t2", name: "Other", slug: "other" },
  ]);
});
afterAll(async () => {
  await ctx.close();
});

const newPrivate = (teamId = "t1") =>
  createBoard(ctx.db, {
    teamId,
    name: `Secret ${++counter}`,
    slug: `secret-${counter}`,
    visibility: "private",
  });
const ip = () => `192.0.2.${++counter % 250}`;

describe("rotateBoardShareLink (US-4.2)", () => {
  it("makes a link, stores only its hash, and shows no link before one exists", async () => {
    const board = await newPrivate();
    expect(await hasActiveShareLink(ctx.db, board.id)).toBe(false);
    const link = await rotateBoardShareLink(ctx.db, "t1", board.id);
    expect(link?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = await findAccessLinkById(ctx.db, link!.id);
    expect(row).toMatchObject({ kind: "board_share", boardId: board.id, teamId: "t1" });
    expect(row?.tokenHash).toBe(hashToken(link!.token));
    expect(JSON.stringify(row)).not.toContain(link!.token);
    expect(await hasActiveShareLink(ctx.db, board.id)).toBe(true);
  });

  it("revokes the earlier link and keeps the new one", async () => {
    const board = await newPrivate();
    const first = await rotateBoardShareLink(ctx.db, "t1", board.id);
    const second = await rotateBoardShareLink(ctx.db, "t1", board.id);
    expect((await findAccessLinkById(ctx.db, first!.id))?.revokedAt).not.toBeNull();
    expect((await findAccessLinkById(ctx.db, second!.id))?.revokedAt).toBeNull();
    expect((await findActiveBoardShareLink(ctx.db, board.id))?.id).toBe(second!.id);
  });

  it("leaves other Boards' links alone", async () => {
    const a = await newPrivate();
    const b = await newPrivate();
    const linkB = await rotateBoardShareLink(ctx.db, "t1", b.id);
    await rotateBoardShareLink(ctx.db, "t1", a.id);
    await rotateBoardShareLink(ctx.db, "t1", a.id);
    expect((await findAccessLinkById(ctx.db, linkB!.id))?.revokedAt).toBeNull();
  });

  it("will not make a link for a Board of another Team or an unknown Board", async () => {
    const theirs = await newPrivate("t2");
    expect(await rotateBoardShareLink(ctx.db, "t1", theirs.id)).toBeNull();
    expect(await rotateBoardShareLink(ctx.db, "t1", "nope")).toBeNull();
    expect(await findActiveBoardShareLink(ctx.db, theirs.id)).toBeNull();
  });

  it("keeps the later link when two rotations land in the same instant", async () => {
    const board = await newPrivate();
    const links = await Promise.all([
      rotateBoardShareLink(ctx.db, "t1", board.id),
      rotateBoardShareLink(ctx.db, "t1", board.id),
    ]);
    const rows = await ctx.db.select().from(accessLinks);
    const mine = rows.filter((r) => r.boardId === board.id);
    expect(mine).toHaveLength(2);
    expect(mine.filter((r) => !r.revokedAt).length).toBeGreaterThanOrEqual(1);
    expect(links.every(Boolean)).toBe(true);
  });
});

describe("previewBoardLink and joinBoardWithLink (US-2.4, G4)", () => {
  it("previews a valid link without using it up", async () => {
    const board = await newPrivate();
    const link = await rotateBoardShareLink(ctx.db, "t1", board.id);
    const expected = { ok: true, teamName: "Acme", boardName: board.name };
    expect(await previewBoardLink(ctx.db, link!.token)).toEqual(expected);
    expect(await previewBoardLink(ctx.db, link!.token)).toEqual(expected);
  });

  it("gives a grant that opens the Board, and the link works for the next Visitor too", async () => {
    const board = await newPrivate();
    const link = await rotateBoardShareLink(ctx.db, "t1", board.id);
    const one = await joinBoardWithLink(ctx.db, ip(), link!.token, []);
    const two = await joinBoardWithLink(ctx.db, ip(), link!.token, []);
    for (const result of [one, two]) {
      expect(result).toMatchObject({ ok: true, path: `/acme/${board.slug}` });
      if (!result.ok) throw new Error("expected ok");
      expect(result.grants).toEqual([{ boardId: board.id, linkId: link!.id }]);
      expect(await canAccessBoard(ctx.db, board, { grants: result.grants })).toBe(true);
    }
  });

  it("keeps grants for other Boards when adding one", async () => {
    const board = await newPrivate();
    const link = await rotateBoardShareLink(ctx.db, "t1", board.id);
    const existing = [{ boardId: "elsewhere", linkId: "l-else" }];
    const result = await joinBoardWithLink(ctx.db, ip(), link!.token, existing);
    if (!result.ok) throw new Error("expected ok");
    expect(result.grants).toHaveLength(2);
    expect(result.grants[0]).toEqual(existing[0]);
  });

  it("calls a rotated link, an unknown token and junk all 'invalid', and the same page for each", async () => {
    const board = await newPrivate();
    const old = await rotateBoardShareLink(ctx.db, "t1", board.id);
    await rotateBoardShareLink(ctx.db, "t1", board.id);
    expect(await previewBoardLink(ctx.db, old!.token)).toEqual({ ok: false });
    expect(await joinBoardWithLink(ctx.db, ip(), old!.token, [])).toEqual({
      ok: false,
      error: "invalid",
    });
    const unknown = "A".repeat(43);
    expect(await previewBoardLink(ctx.db, unknown)).toEqual({ ok: false });
    expect(await joinBoardWithLink(ctx.db, ip(), unknown, [])).toEqual({
      ok: false,
      error: "invalid",
    });
    for (const junk of [undefined, 7, "", "short", null]) {
      expect(await previewBoardLink(ctx.db, junk)).toEqual({ ok: false });
      expect(await joinBoardWithLink(ctx.db, ip(), junk, [])).toEqual({
        ok: false,
        error: "invalid",
      });
    }
  });

  it("rotating ends the access a Visitor already holds", async () => {
    const board = await newPrivate();
    const link = await rotateBoardShareLink(ctx.db, "t1", board.id);
    const joined = await joinBoardWithLink(ctx.db, ip(), link!.token, []);
    if (!joined.ok) throw new Error("expected ok");
    await rotateBoardShareLink(ctx.db, "t1", board.id);
    expect(await canAccessBoard(ctx.db, board, { grants: joined.grants })).toBe(false);
  });

  it("is not fooled by a Member invite or Owner token", async () => {
    const { createAccessLink } = await import("@/data");
    const { generateToken } = await import("@/lib/link-token");
    const token = generateToken();
    await createAccessLink(ctx.db, {
      teamId: "t1",
      kind: "member_invite",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 1e6),
    });
    expect(await previewBoardLink(ctx.db, token)).toEqual({ ok: false });
    expect(await joinBoardWithLink(ctx.db, ip(), token, [])).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("rate limits attempts per IP, valid or not (G5)", async () => {
    const attacker = "198.51.100.77";
    const now = new Date("2026-04-01T10:00:00Z");
    const results = [];
    for (let i = 0; i < 12; i++) {
      results.push(await joinBoardWithLink(ctx.db, attacker, "B".repeat(43), [], now));
    }
    expect(results.slice(0, 10).every((r) => !r.ok && r.error === "invalid")).toBe(true);
    expect(results[11]).toEqual({ ok: false, error: "rate_limited" });
  });
});
