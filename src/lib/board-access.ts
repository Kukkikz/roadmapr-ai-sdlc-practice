import { findAccessLinkById } from "@/data";
import type { Db } from "@/data";
import type { BoardVisibility } from "@/db/schema";
import type { BoardGrant } from "./board-grants";

/** What a requester brings to a Board: their Session's Team and the grants in their cookie. */
export type BoardAccess = { teamId?: string; grants: BoardGrant[] };

/**
 * Whether the requester may see a Board (G3). A Public board: anyone. A Private board: a
 * signed-in Member of the Board's own Team, or a Visitor whose cookie holds a grant for it from
 * a share link that still exists, belongs to this Board and is not revoked, so rotating the link
 * ends access it gave earlier. Everything else answers like a missing Board.
 */
export async function canAccessBoard(
  db: Db,
  board: { id: string; teamId: string; visibility: BoardVisibility },
  access?: BoardAccess,
): Promise<boolean> {
  if (board.visibility === "public") return true;
  if (!access) return false;
  if (access.teamId !== undefined && access.teamId === board.teamId) return true;
  const grant = access.grants.find((g) => g.boardId === board.id);
  if (!grant) return false;
  const link = await findAccessLinkById(db, grant.linkId);
  return (
    link !== null &&
    link.kind === "board_share" &&
    link.boardId === board.id &&
    link.teamId === board.teamId &&
    !link.revokedAt
  );
}
