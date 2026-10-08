import { and, asc, eq } from "drizzle-orm";
import { comments } from "@/db/schema";
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

/** Oldest first. Hidden Comments are included only for moderators. */
export function listComments(db: Db, ideaId: string, opts: { includeHidden?: boolean } = {}) {
  const where = opts.includeHidden
    ? eq(comments.ideaId, ideaId)
    : and(eq(comments.ideaId, ideaId), eq(comments.hidden, false));
  return db.select().from(comments).where(where).orderBy(asc(comments.createdAt));
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
