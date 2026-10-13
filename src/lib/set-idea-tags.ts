import { assignTag, getBoardById, getIdea, listTags, removeTag } from "@/data";
import type { Db } from "@/data";

export type SetIdeaTagsResult = "saved" | "invalid" | "not_found";

/**
 * A Member sets which of the Board's Tags are on an Idea (US-5.2). The caller has already
 * checked with `requireRole` that the requester is a Member of `teamId`, which comes from the
 * Session. `ideaId` and `tagIds` come from the request: an Idea on another Team's Board answers
 * "not_found", and a list that names any Tag outside the Idea's own Board, or is not a list of
 * ids, answers "invalid" with nothing changed. Tags not in the list come off; saving the same set
 * changes nothing.
 */
export async function setIdeaTags(
  db: Db,
  teamId: string,
  ideaId: unknown,
  tagIds: unknown,
): Promise<SetIdeaTagsResult> {
  if (typeof ideaId !== "string") return "not_found";
  // Members moderate, so a hidden Idea still resolves for them.
  const idea = await getIdea(db, ideaId, { includeHidden: true });
  if (!idea) return "not_found";
  const board = await getBoardById(db, idea.boardId);
  if (!board || board.teamId !== teamId) return "not_found";

  if (!Array.isArray(tagIds) || !tagIds.every((id) => typeof id === "string")) return "invalid";
  const wanted = new Set<string>(tagIds);
  const boardTagIds = new Set((await listTags(db, board.id)).map((tag) => tag.id));
  for (const id of wanted) if (!boardTagIds.has(id)) return "invalid";

  const current = new Set(idea.tags.map((tag) => tag.id));
  for (const id of wanted) if (!current.has(id)) await assignTag(db, idea.id, id);
  for (const id of current) if (!wanted.has(id)) await removeTag(db, idea.id, id);
  return "saved";
}
