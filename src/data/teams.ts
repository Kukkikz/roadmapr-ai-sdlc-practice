import { eq } from "drizzle-orm";
import { teams } from "@/db/schema";
import { newId } from "@/db/id";
import type { Db } from "./types";

export async function createTeam(db: Db, input: { name: string; slug: string }) {
  const [row] = await db
    .insert(teams)
    .values({ id: newId(), ...input })
    .returning();
  return row;
}

export async function getTeamBySlug(db: Db, slug: string) {
  const [row] = await db.select().from(teams).where(eq(teams.slug, slug));
  return row ?? null;
}

/**
 * Undoes a Team whose creation failed before any link or Session was shown, so nobody can reach
 * it (SPEC G8). Everything under it goes too. This is not the Owner's delete (US-3.8), which
 * needs its own type-to-confirm flow; never call this on a Team people may be using.
 */
export async function undoTeamCreation(db: Db, teamId: string) {
  await db.delete(teams).where(eq(teams.id, teamId));
}
