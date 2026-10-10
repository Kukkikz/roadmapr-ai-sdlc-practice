import { eq } from "drizzle-orm";
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
