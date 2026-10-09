import { getBoardById, getIdea } from "@/data";
import type { Db } from "@/data";
import { canAccessBoard } from "./board-access";

/**
 * The Board a Visitor may write to, or null. A Board the Visitor cannot see (G3) looks the same
 * as a missing one, so actions answer both with not found.
 */
export async function findBoardForVisitor(db: Db, boardId: string) {
  const board = await getBoardById(db, boardId);
  return board && canAccessBoard(board) ? board : null;
}

/**
 * The Idea a Visitor may vote or comment on, with its Board, or null. Null when the Idea is
 * missing, hidden (G2) or on a Board the Visitor cannot see (G3). Every Visitor write to an
 * existing Idea goes through here, so a stale tab cannot revive a hidden Idea.
 */
export async function findIdeaForVisitor(db: Db, ideaId: string) {
  const idea = await getIdea(db, ideaId);
  if (!idea) return null;
  const board = await findBoardForVisitor(db, idea.boardId);
  return board ? { idea, board } : null;
}
