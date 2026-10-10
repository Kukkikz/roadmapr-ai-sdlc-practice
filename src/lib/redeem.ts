import { createMember, createSession, findAccessLinkByHash } from "@/data";
import type { Db } from "@/data";
import { generateToken, hashToken, isTokenShape } from "./link-token";
import { enforceRateLimit } from "./rate-limit";
import { displayNameSchema, type RedeemKind } from "./redeem-input";

/** SPEC US-3.2: 30 days from sign-in, never extended. */
export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The usable link behind a token for this path, or null. Every failure looks the same, so a
 * caller cannot tell an unknown token from a revoked, expired, wrong-path or orphaned one (G4).
 */
async function findUsableLink(db: Db, kind: RedeemKind, token: unknown, now: Date) {
  if (!isTokenShape(token)) return null;
  const found = await findAccessLinkByHash(db, hashToken(token));
  if (!found || found.link.kind !== kind) return null;
  if (found.link.revokedAt) return null;
  if (found.link.expiresAt && found.link.expiresAt <= now) return null;
  if (kind === "owner") {
    // An Owner link signs in its Member; a removed Member's link is dead (G8).
    if (!found.member || found.member.removedAt || found.member.role !== "owner") return null;
  }
  return found;
}

export type PreviewResult = { ok: true; teamName: string; needsName: boolean } | { ok: false };

/** What the "Continue" page shows. Read-only: opening a link never consumes it (G4). */
export async function previewLink(
  db: Db,
  kind: RedeemKind,
  token: unknown,
  now: Date = new Date(),
): Promise<PreviewResult> {
  const found = await findUsableLink(db, kind, token, now);
  if (!found) return { ok: false };
  return { ok: true, teamName: found.team.name, needsName: kind === "member_invite" };
}

export type RedeemResult =
  | { ok: true; sessionToken: string; expiresAt: Date }
  | { ok: false; error: "invalid" }
  | { ok: false; error: "rate_limited" }
  | { ok: false; error: "invalid_name"; message: string };

/**
 * Presses "Continue" (US-3.2, US-3.3): checks the link, signs the holder in with a new Session
 * and returns its raw token for the cookie. The rate limiter runs first and counts every
 * attempt, valid or not, so guessing tokens is throttled (G5). A Member invite also creates
 * the Member from the display name; an Owner link signs in the Owner it belongs to and stays
 * valid. Every call issues a fresh Session token, so nothing a browser held before survives.
 */
export async function redeemLink(
  db: Db,
  ip: string,
  kind: RedeemKind,
  token: unknown,
  input: { displayName?: unknown },
  now: Date = new Date(),
): Promise<RedeemResult> {
  if (!(await enforceRateLimit(db, "redeem", { ip }, now))) {
    return { ok: false, error: "rate_limited" };
  }
  const found = await findUsableLink(db, kind, token, now);
  if (!found) return { ok: false, error: "invalid" };

  let memberId: string;
  if (kind === "owner") {
    memberId = found.member!.id;
  } else {
    const name = displayNameSchema.safeParse(input.displayName);
    if (!name.success) {
      return { ok: false, error: "invalid_name", message: name.error.issues[0].message };
    }
    const member = await createMember(db, {
      teamId: found.team.id,
      displayName: name.data,
      role: "member",
    });
    memberId = member.id;
  }

  const sessionToken = generateToken();
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
  await createSession(db, { tokenHash: hashToken(sessionToken), memberId, expiresAt });
  return { ok: true, sessionToken, expiresAt };
}
