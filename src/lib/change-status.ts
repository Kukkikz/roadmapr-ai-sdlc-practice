import { z } from "zod";
import { getBoardById, getIdea, setIdeaStatus } from "@/data";
import type { Db } from "@/data";
import { IDEA_STATUSES } from "@/db/schema";

export type ChangeStatusResult = "changed" | "unchanged" | "invalid" | "not_found";

const statusSchema = z.enum(IDEA_STATUSES);

/**
 * A Member changes an Idea's status (US-5.1, G7). The caller has already checked with
 * `requireRole` that the requester is a Member of `teamId`, which comes from the Session.
 * `ideaId` comes from the request, so an Idea on another Team's Board answers "not_found"
 * exactly like a missing one. Any status may follow any other; a change to the status the Idea
 * already has records nothing. `actorId` is `member:<id>`.
 */
export async function changeIdeaStatus(
  db: Db,
  teamId: string,
  actorId: string,
  ideaId: unknown,
  status: unknown,
): Promise<ChangeStatusResult> {
  if (typeof ideaId !== "string") return "not_found";
  // Members moderate, so a hidden Idea still resolves for them.
  const idea = await getIdea(db, ideaId, { includeHidden: true });
  if (!idea) return "not_found";
  const board = await getBoardById(db, idea.boardId);
  if (!board || board.teamId !== teamId) return "not_found";

  const to = statusSchema.safeParse(status);
  if (!to.success) return "invalid";
  return (await setIdeaStatus(db, idea.id, to.data, actorId)) ? "changed" : "unchanged";
}
