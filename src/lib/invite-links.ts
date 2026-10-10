import { createAccessLink, findAccessLinkById, listAccessLinks, revokeAccessLink } from "@/data";
import type { Db } from "@/data";
import { generateToken, hashToken } from "./link-token";

/** SPEC US-3.3: a Member invite link expires 7 days after it is made. */
export const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteStatus = "active" | "expired" | "revoked";

export type InviteLinkRow = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  status: InviteStatus;
};

/**
 * Makes a multi-use Member invite link for a Team (US-3.3). The caller has already checked, with
 * `requireRole`, that the requester is an Owner of `teamId`. The raw token is returned once and
 * never stored: the database keeps only its hash (G4).
 */
export async function createInviteLink(db: Db, teamId: string, now: Date = new Date()) {
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + INVITE_LIFETIME_MS);
  const link = await createAccessLink(db, {
    teamId,
    kind: "member_invite",
    tokenHash: hashToken(token),
    expiresAt,
  });
  return { id: link.id, token, expiresAt };
}

/** A Team's invite links, newest first, with their status. The links themselves are not stored. */
export async function listInviteLinks(
  db: Db,
  teamId: string,
  now: Date = new Date(),
): Promise<InviteLinkRow[]> {
  const rows = await listAccessLinks(db, { teamId, kind: "member_invite" });
  return rows.map((row) => {
    const expiresAt = row.expiresAt ?? new Date(0);
    const status: InviteStatus = row.revokedAt
      ? "revoked"
      : expiresAt <= now
        ? "expired"
        : "active";
    return { id: row.id, createdAt: row.createdAt, expiresAt, status };
  });
}

/**
 * Revokes one of this Team's invite links (US-3.3). `linkId` comes from the request, so it is
 * only honoured for a Member invite link of `teamId`; any other id (another Team's link, an
 * Owner link, a made-up id) gives false and changes nothing. Revoking a link that is already
 * revoked or expired succeeds without changing it. Members who already joined stay (US-3.4).
 */
export async function revokeInviteLink(
  db: Db,
  teamId: string,
  linkId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const link = await findAccessLinkById(db, linkId);
  if (!link || link.teamId !== teamId || link.kind !== "member_invite") return false;
  if (link.revokedAt || (link.expiresAt && link.expiresAt <= now)) return true;
  await revokeAccessLink(db, link.id, now);
  return true;
}
