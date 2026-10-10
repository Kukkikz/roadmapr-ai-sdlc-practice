import { and, asc, eq, getTableColumns, sql } from "drizzle-orm";
import { comments, members } from "@/db/schema";
import { newId } from "@/db/id";
import type { Db } from "./types";

export async function addComment(
  db: Db,
  input: { ideaId: string; body: string; actorId: string; authorName?: string | null },
) {
  const [row] = await db
    .insert(comments)
    .values({ id: newId(), ...input })
    .returning();
  return row;
}

/**
 * Oldest first. Hidden Comments are included only for moderators. `authorTeamId` is the Team of
 * the Member who wrote it, or null for a Visitor; callers show the "Team" label only when it is
 * the Board's own Team. Removed Members keep their row, so their past Comments keep the label.
 */
export function listComments(db: Db, ideaId: string, opts: { includeHidden?: boolean } = {}) {
  const where = opts.includeHidden
    ? eq(comments.ideaId, ideaId)
    : and(eq(comments.ideaId, ideaId), eq(comments.hidden, false));
  return db
    .select({ ...getTableColumns(comments), authorTeamId: members.teamId })
    .from(comments)
    .leftJoin(members, sql`'member:' || ${members.id} = ${comments.actorId}`)
    .where(where)
    .orderBy(asc(comments.createdAt), asc(comments.id));
}

/** Comments are never deleted, only hidden. */
export async function setCommentHidden(db: Db, commentId: string, hidden: boolean) {
  const [row] = await db
    .update(comments)
    .set({ hidden })
    .where(eq(comments.id, commentId))
    .returning();
  return row ?? null;
}
