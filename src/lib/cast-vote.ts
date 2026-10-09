import { countVotes, toggleVote } from "@/data";
import type { Db } from "@/data";
import { enforceRateLimit } from "./rate-limit";
import type { Visitor } from "./visitor";
import { findIdeaForVisitor } from "./visitor-access";

export type CastVoteResult =
  | { ok: true; voted: boolean; voteCount: number }
  | { ok: false; error: "rate_limited" | "not_found" };

/**
 * A Visitor toggles their upvote on an Idea (US-2.2). One vote per Actor is enforced by the
 * votes primary key, so concurrent requests cannot double count. Any status may be voted on.
 * The Idea check (hidden: G2, Private board: G3) comes first so a refused request reveals
 * nothing and a stale tab cannot revive a hidden Idea (so a probe costs reads but also never
 * tells a 429 from a 404).
 */
export async function castVote(
  db: Db,
  visitor: Visitor,
  ip: string,
  ideaId: string,
  now?: Date,
): Promise<CastVoteResult> {
  const found = await findIdeaForVisitor(db, ideaId);
  if (!found) return { ok: false, error: "not_found" };
  if (!(await enforceRateLimit(db, "vote", { ip }, now))) {
    return { ok: false, error: "rate_limited" };
  }
  const voted = await toggleVote(db, found.idea.id, visitor.actorId);
  return { ok: true, voted, voteCount: await countVotes(db, found.idea.id) };
}
