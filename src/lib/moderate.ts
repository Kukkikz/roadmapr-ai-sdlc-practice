import {
  getBoardById,
  getComment,
  getIdea,
  markIdeaReviewed,
  setCommentHidden,
  setIdeaHidden,
} from "@/data";
import type { Db } from "@/data";

export type ModerateResult = "changed" | "unchanged" | "not_found";

/**
 * A Member hides or unhides an Idea (US-5.3, G2). The caller has already checked with
 * `requireRole` that the requester is a Member of `teamId`, which comes from the Session.
 * `ideaId` comes from the request, so an Idea on another Team's Board answers "not_found"
 * exactly like a missing one. Setting the state the Idea already has changes nothing.
 */
export async function moderateIdea(
  db: Db,
  teamId: string,
  ideaId: unknown,
  hidden: boolean,
): Promise<ModerateResult> {
  if (typeof ideaId !== "string") return "not_found";
  const idea = await getIdea(db, ideaId, { includeHidden: true });
  if (!idea) return "not_found";
  const board = await getBoardById(db, idea.boardId);
  if (!board || board.teamId !== teamId) return "not_found";
  // Acting on an Idea, even a no-op, means a Member has looked at it (US-5.5).
  await markIdeaReviewed(db, idea.id);
  if (idea.hidden === hidden) return "unchanged";
  await setIdeaHidden(db, idea.id, hidden);
  return "changed";
}

/** The same for a Comment: it is scoped through its Idea's Board to the Session's Team. */
export async function moderateComment(
  db: Db,
  teamId: string,
  commentId: unknown,
  hidden: boolean,
): Promise<ModerateResult> {
  if (typeof commentId !== "string") return "not_found";
  const comment = await getComment(db, commentId);
  if (!comment) return "not_found";
  const idea = await getIdea(db, comment.ideaId, { includeHidden: true });
  if (!idea) return "not_found";
  const board = await getBoardById(db, idea.boardId);
  if (!board || board.teamId !== teamId) return "not_found";
  if (comment.hidden === hidden) return "unchanged";
  await setCommentHidden(db, comment.id, hidden);
  return "changed";
}
