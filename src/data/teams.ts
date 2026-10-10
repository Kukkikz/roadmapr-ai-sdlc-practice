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

/** Hard delete; everything under the Team goes with it (G8). Only the Owner's confirmed flow may call this, except to undo a half-made Team. */
export async function deleteTeam(db: Db, teamId: string) {
  await db.delete(teams).where(eq(teams.id, teamId));
}
