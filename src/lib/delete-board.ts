import { deleteBoard, getBoardById } from "@/data";
import type { Db } from "@/data";

export type DeleteBoardResult = "deleted" | "wrong_confirmation" | "not_found";

/**
 * Deletes a Board for good after the Owner typed its name (US-4.3, G8). The caller has already
 * checked with `requireRole` that the requester is an Owner of `teamId`, which comes from the
 * Session. `boardId` comes from the request, so a Board of another Team answers "not_found"
 * exactly like a missing one, before the confirmation is even looked at. The confirmation must
 * equal the Board's name (surrounding spaces aside); anything else, including a missing or
 * non-text value, deletes nothing. The cascade removes the Board's Ideas, Votes, Comments, Tags
 * and share links, so its URL becomes "not found" and its slug is free again.
 */
export async function deleteBoardConfirmed(
  db: Db,
  teamId: string,
  boardId: unknown,
  confirmation: unknown,
): Promise<DeleteBoardResult> {
  if (typeof boardId !== "string") return "not_found";
  const board = await getBoardById(db, boardId);
  if (!board || board.teamId !== teamId) return "not_found";
  if (typeof confirmation !== "string" || confirmation.trim() !== board.name) {
    return "wrong_confirmation";
  }
  // Scoped to the Team again, so the delete itself can never reach another Team's Board.
  return (await deleteBoard(db, teamId, board.id)) ? "deleted" : "not_found";
}
