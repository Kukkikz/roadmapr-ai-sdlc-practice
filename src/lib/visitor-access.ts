import { getBoardById, getIdea } from "@/data";
import type { Db } from "@/data";
import { canAccessBoard, type BoardAccess } from "./board-access";

/**
 * The Board a Visitor may write to, or null. A Board the Visitor cannot see (G3) looks the same
 * as a missing one, so actions answer both with not found.
 */
export async function findBoardForVisitor(db: Db, boardId: string, access?: BoardAccess) {
  const board = await getBoardById(db, boardId);
  return board && (await canAccessBoard(db, board, access)) ? board : null;
}

/**
 * The Idea a Visitor may vote or comment on, with its Board, or null. Null when the Idea is
 * missing, hidden (G2) or on a Board the Visitor cannot see (G3). Every Visitor write to an
 * existing Idea goes through here, so a stale tab cannot revive a hidden Idea.
 */
export async function findIdeaForVisitor(db: Db, ideaId: string, access?: BoardAccess) {
  const idea = await getIdea(db, ideaId);
  if (!idea) return null;
  const board = await findBoardForVisitor(db, idea.boardId, access);
  return board ? { idea, board } : null;
}
