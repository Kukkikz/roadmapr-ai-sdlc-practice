"use server";

import { getDb } from "@/db";
import { getClientIp } from "@/lib/client-ip";
import { submitIdea, type SubmitIdeaResult } from "@/lib/submit-idea";
import { suggestSimilarIdeas, type SuggestResult } from "@/lib/similar-ideas";
import { getVisitor } from "@/lib/visitor";

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
};

/** Thin wrapper: reads the request, delegates to `submitIdea`. Reachable by direct POST, so all checks live there. */
export async function submitIdeaAction(
  _previous: SubmitIdeaResult | null,
  formData: FormData,
): Promise<SubmitIdeaResult> {
  const visitor = await getVisitor();
  return submitIdea(getDb(), visitor, await getClientIp(), {
    boardId: text(formData, "boardId"),
    title: text(formData, "title"),
    description: text(formData, "description"),
    authorName: text(formData, "authorName"),
    // A bot can send the honeypot as a file part; any non-text value counts as filled.
    website: formData.get("website") instanceof File ? "file" : text(formData, "website"),
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
