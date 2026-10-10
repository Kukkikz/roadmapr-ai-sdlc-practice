import { createAccessLink, findActiveMember, revokeOwnerLinksBefore } from "@/data";
import type { Db } from "@/data";
import { generateToken, hashToken } from "./link-token";

/**
 * Gives an Owner a replacement Owner link and revokes their earlier ones (US-3.2). The caller
 * has already checked with `requireRole` that `memberId` is the signed-in Owner of `teamId`.
 * The raw token is returned once and never stored: the database keeps only its hash (G4).
 *
 * The new link is made first, so a failure part-way leaves the Owner with too many working
 * links, never none; and only links made before it are revoked. Only this Owner's links are revoked; other Owners keep theirs. Their own
 * Sessions stay signed in. Returns null if `memberId` is not a current Owner of `teamId`.
 */
export async function replaceOwnerLink(
  db: Db,
  teamId: string,
  memberId: string,
  now: Date = new Date(),
) {
  const owner = await findActiveMember(db, teamId, memberId);
  if (!owner || owner.role !== "owner") return null;

  const token = generateToken();
  const link = await createAccessLink(db, {
    teamId,
    kind: "owner",
    tokenHash: hashToken(token),
    memberId,
  });
  // Only links made before this one: two simultaneous replacements cannot revoke each
  // other's new link, so the later one always survives and the Owner is never left with none.
  await revokeOwnerLinksBefore(db, { teamId, memberId, keep: link, now });
  return { id: link.id, token };
}
