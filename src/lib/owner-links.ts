import { createAccessLink, findActiveMember, listAccessLinks, revokeAccessLink } from "@/data";
import type { Db } from "@/data";
import { generateToken, hashToken } from "./link-token";

/**
 * Gives an Owner a replacement Owner link and revokes their earlier ones (US-3.2). The caller
 * has already checked with `requireRole` that `memberId` is the signed-in Owner of `teamId`.
 * The raw token is returned once and never stored: the database keeps only its hash (G4).
 *
 * The new link is made first, so a failure part-way leaves the Owner with too many working
 * links, never none. Only this Owner's links are revoked; other Owners keep theirs. Their own
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
  const earlier = await listAccessLinks(db, { teamId, kind: "owner" });
  for (const old of earlier) {
    if (old.id !== link.id && old.memberId === memberId && !old.revokedAt) {
      await revokeAccessLink(db, old.id, now);
    }
  }
  return { id: link.id, token };
}
