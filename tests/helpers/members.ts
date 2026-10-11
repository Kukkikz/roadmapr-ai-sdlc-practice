import { eq } from "drizzle-orm";
import type { Db } from "@/data";
import { members } from "@/db/schema";

/**
 * Soft-removes a Member with NO guards, for test setup only: it ignores the last-Owner rule and
 * leaves their Sessions alone. The app removes people through `removeTeamMember`.
 */
export async function removeMemberUnguarded(db: Db, memberId: string, now: Date = new Date()) {
  await db.update(members).set({ removedAt: now }).where(eq(members.id, memberId));
}
