import type { BoardVisibility } from "@/db/schema";

/**
 * Whether the current requester may see a Board (G3). Phase 3a: public Boards only, so a
 * Private board answers exactly like a missing one. Phase 4 adds the Member session and
 * Board-share-link cookie checks here, which means a requester argument and an update to
 * the single call site in `board-view.ts`.
 */
export function canAccessBoard(board: { visibility: BoardVisibility }): boolean {
  return board.visibility === "public";
}
