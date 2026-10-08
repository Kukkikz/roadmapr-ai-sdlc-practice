import { and, eq } from "drizzle-orm";
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
