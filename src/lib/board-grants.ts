import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * What a Visitor's signed cookie holds for each Private board they joined (US-4.2): the Board and
 * the share link the access came from. The cookie is only a claim; `canAccessBoard` still checks
 * the link row, so rotating the link ends the access.
 */
export type BoardGrant = { boardId: string; linkId: string };

/** More than this and the oldest grants are dropped, which keeps the cookie small. */
export const MAX_BOARD_GRANTS = 20;

const grantsSchema = z
  .array(z.object({ b: z.string().min(1).max(64), l: z.string().min(1).max(64) }))
  .max(MAX_BOARD_GRANTS);

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`board-access:${payload}`).digest("base64url");
}

/** The cookie value: `<base64url json>.<signature>`. base64url has no ".", so the split is exact. */
export function signBoardGrants(grants: BoardGrant[], secret: string): string {
  const json = JSON.stringify(grants.map((g) => ({ b: g.boardId, l: g.linkId })));
  const payload = Buffer.from(json).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** The grants inside a cookie value; empty if it is missing, malformed or forged. */
export function verifyBoardGrants(value: string | undefined, secret: string): BoardGrant[] {
  if (!value) return [];
  const parts = value.split(".");
  if (parts.length !== 2) return [];
  const [payload, signature] = parts;
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return [];
  try {
    const parsed = grantsSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    return parsed.success ? parsed.data.map((g) => ({ boardId: g.b, linkId: g.l })) : [];
  } catch {
    return [];
  }
}

/** Adds a grant, replacing an earlier one for the same Board and keeping only the newest ones. */
export function withGrant(grants: BoardGrant[], grant: BoardGrant): BoardGrant[] {
  return [...grants.filter((g) => g.boardId !== grant.boardId), grant].slice(-MAX_BOARD_GRANTS);
}
