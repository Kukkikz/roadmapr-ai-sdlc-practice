import { addComment } from "@/data";
import type { Db } from "@/data";
import { submitCommentSchema, type SubmitCommentFields } from "./idea-input";
import { enforceRateLimit } from "./rate-limit";
import type { Visitor } from "./visitor";
import { findIdeaForVisitor } from "./visitor-access";

export type SubmitCommentResult =
  | { ok: true; commentId: string | null }
  | { ok: false; error: "invalid"; fieldErrors: Partial<Record<SubmitCommentFields, string>> }
  | { ok: false; error: "rate_limited" }
  | { ok: false; error: "not_found" };

/**
 * A Visitor comments on an Idea (US-2.3). Same order as `submitIdea`: honeypot and validation
 * first so bots and typos never use up the rate limit, then the Idea check (hidden: G2,
 * Private board: G3), then the limiter, then the insert. Any status may be commented on.
 */
export async function submitComment(
  db: Db,
  visitor: Visitor,
  ip: string,
  input: Record<string, unknown>,
  now?: Date,
): Promise<SubmitCommentResult> {
  // The honeypot is hidden from people; only a bot fills it. Pretend it worked.
  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: true, commentId: null };
  }

  const parsed = submitCommentSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<SubmitCommentFields, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "body" || field === "authorName") fieldErrors[field] ??= issue.message;
    }
    // A bad Idea id is not something the Visitor can fix in the form.
    if (Object.keys(fieldErrors).length === 0) return { ok: false, error: "not_found" };
    return { ok: false, error: "invalid", fieldErrors };
  }
  const { ideaId, body, authorName } = parsed.data;

  const found = await findIdeaForVisitor(db, ideaId);
  if (!found) return { ok: false, error: "not_found" };

  if (!(await enforceRateLimit(db, "comment", { anonId: visitor.anonId, ip }, now))) {
    return { ok: false, error: "rate_limited" };
  }

  const comment = await addComment(db, {
    ideaId: found.idea.id,
    body,
    actorId: visitor.actorId,
    authorName: authorName ?? null,
  });
  return { ok: true, commentId: comment.id };
}
