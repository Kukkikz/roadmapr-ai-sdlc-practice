"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { AuthorizationError, requireSessionRole } from "@/lib/authz";
import { setIdeaTags } from "@/lib/set-idea-tags";
import { formText } from "@/lib/form-data";

export type IdeaTagsState =
  { ok: true } | { ok: false; error: "invalid" | "forbidden" | "not-found" };

/**
 * A Member sets the Tags on an Idea (US-5.2). The first line is `requireSessionRole` (US-3.6); the
 * Team comes from the Session, and `ideaId` and the ticked `tagId` values are only honoured for
 * an Idea on a Board of that Team and Tags of that Board.
 */
export async function setIdeaTagsAction(
  _previous: IdeaTagsState | null,
  formData: FormData,
): Promise<IdeaTagsState> {
  try {
    const { team } = await requireSessionRole("member");
    const result = await setIdeaTags(
      getDb(),
      team.id,
      formText(formData, "ideaId"),
      formData.getAll("tagId"),
    );
    if (result === "not_found") return { ok: false, error: "not-found" };
    if (result === "invalid") return { ok: false, error: "invalid" };
    revalidatePath("/dashboard");
    revalidatePath(`/${team.slug}`, "layout");
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
}
