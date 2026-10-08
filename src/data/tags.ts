import { and, asc, eq } from "drizzle-orm";
import { ideaTags, ideas, tags } from "@/db/schema";
import { newId } from "@/db/id";
import type { Db } from "./types";

export async function createTag(db: Db, input: { boardId: string; name: string; color: string }) {
  const [row] = await db
    .insert(tags)
    .values({ id: newId(), ...input })
    .returning();
  return row;
}

export function listTags(db: Db, boardId: string) {
  return db.select().from(tags).where(eq(tags.boardId, boardId)).orderBy(asc(tags.name));
}

export async function updateTag(db: Db, tagId: string, patch: { name?: string; color?: string }) {
  const [row] = await db.update(tags).set(patch).where(eq(tags.id, tagId)).returning();
  return row ?? null;
}

/** Hard delete; the Tag disappears from every Idea (cascade). */
export async function deleteTag(db: Db, tagId: string) {
  await db.delete(tags).where(eq(tags.id, tagId));
}

/** Applies a Tag to an Idea. Throws if the Idea is missing or the Tag is on another Board. */
export async function assignTag(db: Db, ideaId: string, tagId: string) {
  const [idea] = await db
    .select({ boardId: ideas.boardId })
    .from(ideas)
    .where(eq(ideas.id, ideaId));
  if (!idea) throw new Error("Idea not found");
  await db.insert(ideaTags).values({ ideaId, tagId, boardId: idea.boardId }).onConflictDoNothing();
}

export async function removeTag(db: Db, ideaId: string, tagId: string) {
  await db.delete(ideaTags).where(and(eq(ideaTags.ideaId, ideaId), eq(ideaTags.tagId, tagId)));
}
