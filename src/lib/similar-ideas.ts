import { findSimilarIdeas } from "@/data";
import type { Db } from "@/data";
import type { IdeaStatus } from "@/db/schema";
import { IDEA_LIMITS } from "./idea-input";
import { enforceRateLimit } from "./rate-limit";
import { findBoardForVisitor } from "./visitor-access";

export type SimilarIdea = { id: string; title: string; status: IdeaStatus; voteCount: number };

export type SuggestResult =
  { ok: true; ideas: SimilarIdea[] } | { ok: false; error: "rate_limited" | "not_found" };

/**
 * Board lookups and too-short titles are not counted: the limiter guards the full-text query,
 * which is the expensive part.
 */
/** Too short to say anything useful; also saves a request while the Visitor starts typing. */
const MIN_TITLE_LENGTH = 3;

/**
 * The duplicate hint (US-2.1): up to 3 similar Ideas for a title being typed. Rate limited per
 * IP, because it runs a query on every pause in typing.
 */
export async function suggestSimilarIdeas(
  db: Db,
  ip: string,
  input: { boardId: string; title: string },
  now?: Date,
): Promise<SuggestResult> {
  const title = input.title.trim().slice(0, IDEA_LIMITS.title);
  const board = await findBoardForVisitor(db, input.boardId);
  if (!board) return { ok: false, error: "not_found" };
  if (title.length < MIN_TITLE_LENGTH) return { ok: true, ideas: [] };
  if (!(await enforceRateLimit(db, "similar", { ip }, now))) {
    return { ok: false, error: "rate_limited" };
  }
  return { ok: true, ideas: await findSimilarIdeas(db, { boardId: board.id, title }) };
}
