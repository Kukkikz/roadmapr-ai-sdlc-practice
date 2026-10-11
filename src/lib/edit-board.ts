import { getBoardBySlugs, updateBoard } from "@/data";
import type { Db } from "@/data";
import { SLUG_TAKEN } from "./create-board";
import { boardFieldErrors, createBoardSchema, type BoardFieldErrors } from "./create-board-input";

export type EditBoardResult =
  | { ok: true; boardSlug: string; boardName: string }
  | { ok: false; error: "invalid"; fieldErrors: BoardFieldErrors }
  | { ok: false; error: "not-found" };

/**
 * Edits a Board's name, slug and description (US-4.1). The caller has already checked with
 * `requireRole` that the requester is an Owner of `team`. `boardId` comes from the request, so
 * the update is scoped to the Team: a Board of another Team answers like a missing one. The
 * visibility is not editable yet (US-4.2).
 */
export async function editBoardForTeam(
  db: Db,
  team: { id: string; slug: string },
  boardId: string,
  input: Record<string, unknown>,
): Promise<EditBoardResult> {
  const parsed = createBoardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: boardFieldErrors(parsed.error) };
  }
  const { name, slug, description } = parsed.data;

  const taken = async () => {
    const other = await getBoardBySlugs(db, team.slug, slug);
    return other !== null && other.board.id !== boardId;
  };
  if (await taken()) return { ok: false, error: "invalid", fieldErrors: { slug: SLUG_TAKEN } };

  try {
    const board = await updateBoard(db, team.id, boardId, {
      name,
      slug,
      description: description ?? null,
    });
    if (!board) return { ok: false, error: "not-found" };
    return { ok: true, boardSlug: board.slug, boardName: board.name };
  } catch (error) {
    // Someone took the slug between the check and the update (unique per Team).
    if (await taken()) return { ok: false, error: "invalid", fieldErrors: { slug: SLUG_TAKEN } };
    throw error;
  }
}
