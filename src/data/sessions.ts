import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { members, sessions, teams } from "@/db/schema";
import type { Db } from "./types";

/** Stores a Session by the hash of its token. The raw token only lives in the cookie. */
export async function createSession(
  db: Db,
  input: { tokenHash: string; memberId: string; expiresAt: Date },
) {
  const [row] = await db.insert(sessions).values(input).returning();
  return row;
}

/**
 * The live Session with this token hash: not expired, and its Member not removed (G8), so
 * removing a Member ends their Sessions immediately without touching the sessions table.
 */
export async function findSessionByHash(db: Db, tokenHash: string, now: Date = new Date()) {
  const [row] = await db
    .select({ session: sessions, member: members, team: teams })
    .from(sessions)
    .innerJoin(members, eq(sessions.memberId, members.id))
    .innerJoin(teams, eq(members.teamId, teams.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, now),
        isNull(members.removedAt),
      ),
    );
  return row ?? null;
}

/** Deletes Sessions that expired at or before `now`. They are already refused; this keeps the table small. */
export async function purgeExpiredSessions(db: Db, now: Date = new Date()) {
  await db.delete(sessions).where(lte(sessions.expiresAt, now));
}

export async function deleteSession(db: Db, tokenHash: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}
