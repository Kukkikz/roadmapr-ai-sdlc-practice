import { and, asc, eq } from "drizzle-orm";
import { boards, teams, type BoardVisibility } from "@/db/schema";
import { newId } from "@/db/id";
import type { Db } from "./types";

export async function createBoard(
  db: Db,
  input: {
    teamId: string;
    name: string;
    slug: string;
    description?: string;
    visibility?: BoardVisibility;
  },
) {
  const [row] = await db
    .insert(boards)
    .values({ id: newId(), ...input })
    .returning();
  return row;
}

/** Resolves `/{team-slug}/{board-slug}`. */
export async function getBoardBySlugs(db: Db, teamSlug: string, boardSlug: string) {
  const [row] = await db
    .select({ board: boards, team: teams })
    .from(boards)
    .innerJoin(teams, eq(boards.teamId, teams.id))
    .where(and(eq(teams.slug, teamSlug), eq(boards.slug, boardSlug)));
  return row ?? null;
}

/** One Board by id, or null. */
export async function getBoardById(db: Db, boardId: string) {
  const [row] = await db.select().from(boards).where(eq(boards.id, boardId));
  return row ?? null;
}

export function listBoardsForTeam(db: Db, teamId: string) {
  return db
    .select()
    .from(boards)
    .where(eq(boards.teamId, teamId))
    .orderBy(asc(boards.createdAt), asc(boards.id));
}
