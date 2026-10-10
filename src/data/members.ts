import { and, asc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { members, type MemberRole } from "@/db/schema";
import { newId } from "@/db/id";
import type { Db } from "./types";

export async function createMember(
  db: Db,
  input: { teamId: string; displayName: string; role: MemberRole },
) {
  const [row] = await db
    .insert(members)
    .values({ id: newId(), ...input })
    .returning();
  return row;
}

/** Soft removal (G8): the row stays so history keeps the name. */
export async function removeMember(db: Db, memberId: string, now: Date = new Date()) {
  await db.update(members).set({ removedAt: now }).where(eq(members.id, memberId));
}

/** A Team's current (not removed) Members, Owners first, then in the order they joined. */
export function listActiveMembers(db: Db, teamId: string) {
  return db
    .select()
    .from(members)
    .where(and(eq(members.teamId, teamId), isNull(members.removedAt)))
    .orderBy(
      sql`(case when ${members.role} = 'owner' then 0 else 1 end)`,
      asc(members.createdAt),
      asc(members.id),
    );
}

/** One current Member of this Team, or null (missing, in another Team, or already removed). */
export async function findActiveMember(db: Db, teamId: string, memberId: string) {
  const [row] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.teamId, teamId), isNull(members.removedAt)));
  return row ?? null;
}

export async function countActiveOwners(db: Db, teamId: string) {
  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.teamId, teamId), eq(members.role, "owner"), isNull(members.removedAt)));
  return rows.length;
}

/**
 * Soft removal (G8) in one guarded statement: only a current Member of `teamId`, and an Owner
 * only while another Owner remains (the last Owner can never be removed). Returns whether a
 * row changed. The row stays, so history keeps the name.
 */
export async function softRemoveMember(
  db: Db,
  input: { teamId: string; memberId: string; now?: Date },
) {
  const rows = await db
    .update(members)
    .set({ removedAt: input.now ?? new Date() })
    .where(
      and(
        eq(members.id, input.memberId),
        eq(members.teamId, input.teamId),
        isNull(members.removedAt),
        or(
          ne(members.role, "owner"),
          sql`(select count(*) from members as other_owners where other_owners.team_id = ${input.teamId} and other_owners.role = 'owner' and other_owners.removed_at is null) > 1`,
        ),
      ),
    )
    .returning({ id: members.id });
  return rows.length > 0;
}

/** Undoes a soft removal. Only for compensating a removal that left a Team with no Owner. */
export async function restoreMember(db: Db, memberId: string) {
  await db.update(members).set({ removedAt: null }).where(eq(members.id, memberId));
}
