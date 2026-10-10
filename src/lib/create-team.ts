import {
  createAccessLink,
  createBoard,
  createMember,
  createSession,
  createTeam,
  deleteSession,
  deleteTeam,
  getTeamBySlug,
} from "@/data";
import type { Db } from "@/data";
import { createTeamSchema, type CreateTeamFields } from "./create-team-input";
import { generateToken, hashToken, isTokenShape } from "./link-token";
import { enforceRateLimit } from "./rate-limit";
import { SESSION_LIFETIME_MS } from "./redeem";
import { boardSlugFor } from "./slugs";

export type CreateTeamResult =
  | {
      ok: true;
      teamName: string;
      /** The raw Owner link token. It exists only in this result: the database keeps its hash. */
      ownerToken: string;
      sessionToken: string;
      expiresAt: Date;
    }
  | { ok: false; error: "invalid"; fieldErrors: Partial<Record<CreateTeamFields, string>> }
  | { ok: false; error: "rate_limited" };

const SLUG_TAKEN = "This slug is taken. Choose another.";

/**
 * Anyone creates a Team (US-3.1): the Team, its Owner (named by the creator), a public first
 * Board, an Owner link and a Session for the creator. Order, as for other public actions:
 * validation and the slug check first, so typos never use up the limit (G5), then the limiter,
 * then the writes. Over Neon's HTTP driver there is no transaction, so a failure after the Team
 * exists deletes it again instead of leaving a half-made Team behind.
 */
export async function createTeamWithOwner(
  db: Db,
  ip: string,
  input: Record<string, unknown>,
  options: { previousSessionToken?: unknown; now?: Date } = {},
): Promise<CreateTeamResult> {
  const now = options.now ?? new Date();
  const parsed = createTeamSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<CreateTeamFields, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as CreateTeamFields;
      fieldErrors[field] ??= issue.message;
    }
    return { ok: false, error: "invalid", fieldErrors };
  }
  const { teamName, teamSlug, boardName, displayName } = parsed.data;

  if (await getTeamBySlug(db, teamSlug)) {
    return { ok: false, error: "invalid", fieldErrors: { teamSlug: SLUG_TAKEN } };
  }
  if (!(await enforceRateLimit(db, "createTeam", { ip }, now))) {
    return { ok: false, error: "rate_limited" };
  }

  let team;
  try {
    team = await createTeam(db, { name: teamName, slug: teamSlug });
  } catch (error) {
    // Someone else took the slug between the check and the insert.
    if (await getTeamBySlug(db, teamSlug)) {
      return { ok: false, error: "invalid", fieldErrors: { teamSlug: SLUG_TAKEN } };
    }
    throw error;
  }

  try {
    const owner = await createMember(db, { teamId: team.id, displayName, role: "owner" });
    await createBoard(db, { teamId: team.id, name: boardName, slug: boardSlugFor(boardName) });
    const ownerToken = generateToken();
    await createAccessLink(db, {
      teamId: team.id,
      kind: "owner",
      tokenHash: hashToken(ownerToken),
      memberId: owner.id,
    });
    const sessionToken = generateToken();
    const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
    await createSession(db, { tokenHash: hashToken(sessionToken), memberId: owner.id, expiresAt });
    // One browser, one Session: the creator is now signed in to this Team only. Best effort.
    if (isTokenShape(options.previousSessionToken)) {
      await deleteSession(db, hashToken(options.previousSessionToken)).catch(() => {});
    }
    return { ok: true, teamName: team.name, ownerToken, sessionToken, expiresAt };
  } catch (error) {
    await deleteTeam(db, team.id).catch(() => {});
    throw error;
  }
}
