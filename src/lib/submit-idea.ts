import { createIdea } from "@/data";
import type { Db } from "@/data";
import { submitIdeaSchema, type SubmitIdeaFields } from "./idea-input";
import { authorNameFor } from "./author";
import { enforceRateLimit } from "./rate-limit";
import type { Visitor } from "./visitor";
import { findBoardForVisitor } from "./visitor-access";

export type SubmitIdeaResult =
  | { ok: true; ideaId: string | null }
  | { ok: false; error: "invalid"; fieldErrors: Partial<Record<SubmitIdeaFields, string>> }
  | { ok: false; error: "rate_limited" }
  | { ok: false; error: "not_found" };

/**
 * A Visitor submits an Idea (US-2.1). Order matters: the honeypot and validation come first
 * so bots and typos never use up the rate limit; the Board check (G3) comes before the limiter
 * so a Private board cannot be probed; the limiter comes before the insert so a refused
 * submission creates nothing.
 */
export async function submitIdea(
  db: Db,
  visitor: Visitor,
  ip: string,
  input: Record<string, unknown>,
  now?: Date,
): Promise<SubmitIdeaResult> {
  // The honeypot is hidden from people; only a bot fills it. Pretend it worked.
  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: true, ideaId: null };
  }

  const parsed = submitIdeaSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<SubmitIdeaFields, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "title" || field === "description" || field === "authorName") {
        fieldErrors[field] ??= issue.message;
      }
    }
    // A bad Board id is not something the Visitor can fix in the form.
    if (Object.keys(fieldErrors).length === 0) return { ok: false, error: "not_found" };
    return { ok: false, error: "invalid", fieldErrors };
  }
  const { boardId, title, description, authorName } = parsed.data;

  const board = await findBoardForVisitor(db, boardId);
  if (!board) return { ok: false, error: "not_found" };

  if (!(await enforceRateLimit(db, "submit", { anonId: visitor.anonId, ip }, now))) {
    return { ok: false, error: "rate_limited" };
  }

  const idea = await createIdea(db, {
    boardId: board.id,
    title,
    description,
    actorId: visitor.actorId,
    authorName: authorNameFor(visitor, authorName),
  });
  return { ok: true, ideaId: idea.id };
}
