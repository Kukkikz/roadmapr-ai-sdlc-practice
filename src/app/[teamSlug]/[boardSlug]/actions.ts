"use server";

import { getDb } from "@/db";
import { castVote, type CastVoteResult } from "@/lib/cast-vote";
import { getClientIp } from "@/lib/client-ip";
import { formText, honeypotValue } from "@/lib/form-data";
import { submitIdea, type SubmitIdeaResult } from "@/lib/submit-idea";
import { submitComment, type SubmitCommentResult } from "@/lib/submit-comment";
import { suggestSimilarIdeas, type SuggestResult } from "@/lib/similar-ideas";
import { getVisitor } from "@/lib/visitor";

/** Thin wrapper: reads the request, delegates to `submitIdea`. Reachable by direct POST, so all checks live there. */
export async function submitIdeaAction(
  _previous: SubmitIdeaResult | null,
  formData: FormData,
): Promise<SubmitIdeaResult> {
  const visitor = await getVisitor();
  return submitIdea(getDb(), visitor, await getClientIp(), {
    boardId: formText(formData, "boardId"),
    title: formText(formData, "title"),
    description: formText(formData, "description"),
    authorName: formText(formData, "authorName"),
    website: honeypotValue(formData),
  });
}

export async function suggestSimilarIdeasAction(
  boardId: string,
  title: string,
): Promise<SuggestResult> {
  if (typeof boardId !== "string" || typeof title !== "string") {
    return { ok: false, error: "not_found" };
  }
  return suggestSimilarIdeas(getDb(), await getClientIp(), { boardId, title });
}

export async function toggleVoteAction(ideaId: string): Promise<CastVoteResult> {
  if (typeof ideaId !== "string") return { ok: false, error: "not_found" };
  const visitor = await getVisitor();
  return castVote(getDb(), visitor, await getClientIp(), ideaId);
}

export async function submitCommentAction(
  _previous: SubmitCommentResult | null,
  formData: FormData,
): Promise<SubmitCommentResult> {
  const visitor = await getVisitor();
  return submitComment(getDb(), visitor, await getClientIp(), {
    ideaId: formText(formData, "ideaId"),
    body: formText(formData, "body"),
    authorName: formText(formData, "authorName"),
    website: honeypotValue(formData),
  });
}
