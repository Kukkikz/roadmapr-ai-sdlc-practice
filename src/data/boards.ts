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

/** Updates a Board of the given Team; returns the row, or null when the Team has no such Board. */
export async function updateBoard(
  db: Db,
  teamId: string,
  boardId: string,
  fields: {
    name: string;
    slug: string;
    description: string | null;
    visibility: BoardVisibility;
  },
) {
  const [row] = await db
    .update(boards)
    .set(fields)
    .where(and(eq(boards.id, boardId), eq(boards.teamId, teamId)))
    .returning();
  return row ?? null;
}

/**
 * Deletes a Board of the given Team for good; true if one was deleted. The database cascades to
 * its Ideas, Votes, Comments, Tags and share links. Only the confirmed Owner flow
 * (`deleteBoardConfirmed`) may call this.
 */
export async function deleteBoard(db: Db, teamId: string, boardId: string): Promise<boolean> {
  const rows = await db
    .delete(boards)
    .where(and(eq(boards.id, boardId), eq(boards.teamId, teamId)))
    .returning({ id: boards.id });
  return rows.length > 0;
}
