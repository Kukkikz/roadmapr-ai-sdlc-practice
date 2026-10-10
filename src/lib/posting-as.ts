import type { Visitor } from "./visitor";

/** How a signed-in Member's next post will be shown (US-5.4). Null for Visitors. */
export type PostingAs = { name: string; asTeam: boolean };

/**
 * Whether this Visitor is a Member, and whether the Board belongs to their own Team. Only a Member
 * of the Board's Team gets the "Team" label; a Member of another Team posts under their name alone.
 */
export function postingAsFor(visitor: Visitor | null, boardTeamId: string): PostingAs | null {
  if (!visitor?.memberId) return null;
  return { name: visitor.displayName ?? "", asTeam: visitor.teamId === boardTeamId };
}
