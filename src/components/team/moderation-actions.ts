"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { AuthorizationError, requireSessionRole } from "@/lib/authz";
import { formText } from "@/lib/form-data";
import { moderateComment, moderateIdea, type ModerateResult } from "@/lib/moderate";

export type ModerationState =
  { ok: true } | { ok: false; error: "forbidden" | "not-found" | "invalid" };

async function run(
  formData: FormData,
  idField: string,
  apply: (teamId: string, id: unknown, hidden: boolean) => Promise<ModerateResult>,
): Promise<ModerationState> {
  try {
    const { team } = await requireSessionRole("member");
    // Fail closed: anything but exactly "true" or "false" changes nothing.
    const hidden = formText(formData, "hidden");
    if (hidden !== "true" && hidden !== "false") return { ok: false, error: "invalid" };
    const result = await apply(team.id, formText(formData, idField), hidden === "true");
    if (result === "not_found") return { ok: false, error: "not-found" };
    revalidatePath("/dashboard");
    revalidatePath(`/${team.slug}`, "layout");
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
}

/** A Member hides or unhides an Idea (US-5.3). The first line is `requireSessionRole`. */
export async function setIdeaHiddenAction(
  _previous: ModerationState | null,
  formData: FormData,
): Promise<ModerationState> {
  return run(formData, "ideaId", (teamId, id, hidden) => moderateIdea(getDb(), teamId, id, hidden));
}

/** A Member hides or unhides a Comment (US-5.3). */
export async function setCommentHiddenAction(
  _previous: ModerationState | null,
  formData: FormData,
): Promise<ModerationState> {
  return run(formData, "commentId", (teamId, id, hidden) =>
    moderateComment(getDb(), teamId, id, hidden),
  );
}
