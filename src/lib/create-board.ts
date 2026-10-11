import { createBoard, getBoardBySlugs } from "@/data";
import type { Db } from "@/data";
import { boardFieldErrors, createBoardSchema, type BoardFieldErrors } from "./create-board-input";

export type CreateBoardResult =
  | { ok: true; boardSlug: string; boardName: string }
  | { ok: false; error: "invalid"; fieldErrors: BoardFieldErrors };

export const SLUG_TAKEN = "This slug is taken in your Team. Choose another.";

/**
 * Creates a Board in a Team (US-4.1). The caller has already checked with `requireRole`
 * that the requester is an Owner of `team`, and `team` comes from the Session, never from the
 * request. The slug is unique within the Team (two Teams may share one). The visibility is
 * Public unless the Owner chose Private.
 */
export async function createBoardForTeam(
  db: Db,
  team: { id: string; slug: string },
  input: Record<string, unknown>,
): Promise<CreateBoardResult> {
  const parsed = createBoardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: boardFieldErrors(parsed.error) };
  }
  const { name, slug, description, visibility } = parsed.data;

  if (await getBoardBySlugs(db, team.slug, slug)) {
    return { ok: false, error: "invalid", fieldErrors: { slug: SLUG_TAKEN } };
  }
  try {
    const board = await createBoard(db, {
      teamId: team.id,
      name,
      slug,
      description,
      visibility,
    });
    return { ok: true, boardSlug: board.slug, boardName: board.name };
  } catch (error) {
    // Someone took the slug between the check and the insert (unique per Team).
    if (await getBoardBySlugs(db, team.slug, slug)) {
      return { ok: false, error: "invalid", fieldErrors: { slug: SLUG_TAKEN } };
    }
    throw error;
  }
}
