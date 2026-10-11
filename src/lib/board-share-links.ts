import {
  createAccessLink,
  findActiveBoardShareLink,
  findBoardShareLinkByHash,
  getBoardById,
  revokeBoardShareLinksBefore,
} from "@/data";
import type { Db } from "@/data";
import type { BoardGrant } from "./board-grants";
import { withGrant } from "./board-grants";
import { generateToken, hashToken, isTokenShape } from "./link-token";
import { enforceRateLimit } from "./rate-limit";

/**
 * Makes a Board's share link, or replaces it (US-4.2). The caller has already checked with
 * `requireRole` that the requester is an Owner of `teamId`; `boardId` comes from the request, so
 * a Board of another Team gives null and changes nothing. The raw token is returned once and
 * never stored: the database keeps only its hash (G4).
 *
 * The new link is made first, so a failure part-way leaves too many working links, never none,
 * and only links made before it are revoked: two simultaneous rotations cannot revoke each
 * other's new link. Revoking is what ends the access earlier links gave (`canAccessBoard`).
 */
export async function rotateBoardShareLink(
  db: Db,
  teamId: string,
  boardId: string,
  now: Date = new Date(),
) {
  const board = await getBoardById(db, boardId);
  if (!board || board.teamId !== teamId) return null;
  const token = generateToken();
  const link = await createAccessLink(db, {
    teamId,
    boardId: board.id,
    kind: "board_share",
    tokenHash: hashToken(token),
  });
  await revokeBoardShareLinksBefore(db, { boardId: board.id, keep: link, now });
  return { id: link.id, token };
}

/**
 * The usable link behind a token, or null. Every failure looks the same, so a caller cannot tell
 * an unknown token from a revoked or other-kind one (G4).
 */
async function findUsableShareLink(db: Db, token: unknown) {
  if (!isTokenShape(token)) return null;
  const found = await findBoardShareLinkByHash(db, hashToken(token));
  if (!found || found.link.revokedAt) return null;
  if (found.link.expiresAt && found.link.expiresAt <= new Date()) return null;
  if (found.link.teamId !== found.team.id) return null;
  return found;
}

export type BoardLinkPreview = { ok: true; teamName: string; boardName: string } | { ok: false };

/** What the "Continue" page shows. Read-only: opening a link never uses it up (G4). */
export async function previewBoardLink(db: Db, token: unknown): Promise<BoardLinkPreview> {
  const found = await findUsableShareLink(db, token);
  return found
    ? { ok: true, teamName: found.team.name, boardName: found.board.name }
    : { ok: false };
}

export type JoinBoardResult =
  | { ok: true; grants: BoardGrant[]; path: string }
  | { ok: false; error: "invalid" | "rate_limited" };

/**
 * Presses "Continue" on a Board share link (US-2.4): checks the link and returns the grants the
 * cookie should now hold, plus where to send the Visitor. The link stays valid for the next
 * Visitor. The rate limiter runs first and counts every attempt, valid or not (G5).
 */
export async function joinBoardWithLink(
  db: Db,
  ip: string,
  token: unknown,
  currentGrants: BoardGrant[],
  now: Date = new Date(),
): Promise<JoinBoardResult> {
  if (!(await enforceRateLimit(db, "redeem", { ip }, now))) {
    return { ok: false, error: "rate_limited" };
  }
  const found = await findUsableShareLink(db, token);
  if (!found) return { ok: false, error: "invalid" };
  return {
    ok: true,
    grants: withGrant(currentGrants, { boardId: found.board.id, linkId: found.link.id }),
    path: `/${found.team.slug}/${found.board.slug}`,
  };
}

/** Whether a Board has a working share link, for the settings screen. */
export async function hasActiveShareLink(db: Db, boardId: string): Promise<boolean> {
  return (await findActiveBoardShareLink(db, boardId)) !== null;
}
