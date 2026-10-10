import { deleteTeam } from "@/data";
import type { Db } from "@/data";

export type DeleteTeamResult = "deleted" | "wrong_confirmation";

/**
 * Deletes a Team for good after the Owner typed its slug (US-3.8, G8). The caller has already
 * checked with `requireRole` that the requester is an Owner of `team`, and `team` comes from the
 * Session, never from the request. The confirmation must equal the slug exactly (surrounding
 * spaces aside); anything else, including a missing or non-text value, deletes nothing. The
 * cascade removes every Board, Idea, Vote, Comment, Tag, Member, link and Session of the Team,
 * so all of its links and sessions stop working and its pages become "not found".
 */
export async function deleteTeamConfirmed(
  db: Db,
  team: { id: string; slug: string },
  confirmation: unknown,
): Promise<DeleteTeamResult> {
  if (typeof confirmation !== "string" || confirmation.trim() !== team.slug) {
    return "wrong_confirmation";
  }
  await deleteTeam(db, team.id);
  return "deleted";
}
