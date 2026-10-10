import {
  countActiveOwners,
  deleteSessionsForMember,
  findActiveMember,
  restoreMember,
  softRemoveMember,
} from "@/data";
import type { Db } from "@/data";

export type RemoveMemberResult = "removed" | "not_found" | "last_owner";

/**
 * Removes a Member from a Team (US-3.4) or lets them leave it (US-3.7, the same act applied to
 * oneself). The caller has already checked authorisation with `requireRole`. `memberId` may come
 * from the request, so it is only honoured for a current Member of `teamId`.
 *
 * Removal is soft (G8): the row stays, so past Ideas and Comments keep the display name. The
 * Member's Sessions end at once (they are also refused on lookup), and an Owner link of a removed
 * Owner stops working. The last Owner can never be removed. The guard is one statement, but
 * Neon's HTTP driver has no transaction, so two Owners removing each other at the same instant
 * could both pass it; the check afterwards puts the Member back if that left no Owner. That
 * compensation is not atomic either: a process crash between the two steps would leave a Team
 * with no Owner, which only a database fix can undo. That risk is accepted.
 */
export async function removeTeamMember(
  db: Db,
  teamId: string,
  memberId: string,
  now: Date = new Date(),
): Promise<RemoveMemberResult> {
  const target = await findActiveMember(db, teamId, memberId);
  if (!target) return "not_found";

  const removed = await softRemoveMember(db, { teamId, memberId, now });
  if (!removed) {
    // Refused by the guard: either the last Owner, or someone else removed them just now.
    return (await findActiveMember(db, teamId, memberId)) ? "last_owner" : "not_found";
  }
  if (target.role === "owner" && (await countActiveOwners(db, teamId)) === 0) {
    await restoreMember(db, memberId);
    return "last_owner";
  }
  await deleteSessionsForMember(db, memberId);
  return "removed";
}
