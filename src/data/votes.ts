import { and, eq, inArray, sql } from "drizzle-orm";
import { votes } from "@/db/schema";
import type { Db } from "./types";

/** Idempotent: a second vote by the same actor is a no-op (primary key). */
export async function addVote(db: Db, ideaId: string, actorId: string) {
  await db.insert(votes).values({ ideaId, actorId }).onConflictDoNothing();
}

export async function removeVote(db: Db, ideaId: string, actorId: string) {
  await db.delete(votes).where(and(eq(votes.ideaId, ideaId), eq(votes.actorId, actorId)));
}

/** Toggles the actor's vote. Returns whether the actor now has a vote on the Idea. */
export async function toggleVote(db: Db, ideaId: string, actorId: string) {
  const inserted = await db
    .insert(votes)
    .values({ ideaId, actorId })
    .onConflictDoNothing()
    .returning({ ideaId: votes.ideaId });
  if (inserted.length > 0) return true;
  await removeVote(db, ideaId, actorId);
  return false;
}

export async function hasVoted(db: Db, ideaId: string, actorId: string) {
  const rows = await db
    .select({ ideaId: votes.ideaId })
    .from(votes)
    .where(and(eq(votes.ideaId, ideaId), eq(votes.actorId, actorId)));
  return rows.length > 0;
}

export async function countVotes(db: Db, ideaId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(votes)
    .where(eq(votes.ideaId, ideaId));
  return row.count;
}

/** Which of `ideaIds` this Actor has voted for, in one query (for rendering a page of Ideas). */
export async function votedIdeaIds(db: Db, actorId: string, ideaIds: string[]) {
  if (ideaIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ ideaId: votes.ideaId })
    .from(votes)
    .where(and(eq(votes.actorId, actorId), inArray(votes.ideaId, ideaIds)));
  return new Set(rows.map((row) => row.ideaId));
}
