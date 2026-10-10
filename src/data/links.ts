import { and, desc, eq } from "drizzle-orm";
import { accessLinks, members, teams, type LinkKind } from "@/db/schema";
import { newId } from "@/db/id";
import type { Db } from "./types";

/** Stores a link by the hash of its token. The raw token never reaches the database (G4). */
export async function createAccessLink(
  db: Db,
  input: {
    teamId: string;
    kind: LinkKind;
    tokenHash: string;
    memberId?: string;
    boardId?: string;
    expiresAt?: Date;
  },
) {
  const [row] = await db
    .insert(accessLinks)
    .values({ id: newId(), ...input })
    .returning();
  return row;
}

/** The link with this token hash, with its Team and (for an Owner link) its Member, or null. */
export async function findAccessLinkByHash(db: Db, tokenHash: string) {
  const [row] = await db
    .select({ link: accessLinks, team: teams, member: members })
    .from(accessLinks)
    .innerJoin(teams, eq(accessLinks.teamId, teams.id))
    .leftJoin(members, eq(accessLinks.memberId, members.id))
    .where(eq(accessLinks.tokenHash, tokenHash));
  return row ?? null;
}

/** One link by id, or null. Callers must still check it belongs to the Team they act for. */
export async function findAccessLinkById(db: Db, linkId: string) {
  const [row] = await db.select().from(accessLinks).where(eq(accessLinks.id, linkId));
  return row ?? null;
}

/** A Team's links of one kind, newest first. Never includes the token: only its hash is stored. */
export function listAccessLinks(db: Db, input: { teamId: string; kind: LinkKind }) {
  return db
    .select()
    .from(accessLinks)
    .where(and(eq(accessLinks.teamId, input.teamId), eq(accessLinks.kind, input.kind)))
    .orderBy(desc(accessLinks.createdAt), desc(accessLinks.id));
}

export async function revokeAccessLink(db: Db, linkId: string, now: Date = new Date()) {
  await db.update(accessLinks).set({ revokedAt: now }).where(eq(accessLinks.id, linkId));
}
