"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { AuthorizationError, requireSessionRole } from "@/lib/authz";
import { changeIdeaStatus } from "@/lib/change-status";
import { formText } from "@/lib/form-data";

export type ChangeStatusState =
  { ok: true } | { ok: false; error: "invalid" | "forbidden" | "not-found" };

/**
 * A Member changes an Idea's status (US-5.1). The first line is `requireSessionRole` (US-3.6);
 * the Team comes from the Session, and `ideaId` is only honoured for an Idea on a Board of that
 * Team. The status is validated on the server whatever the form offered.
 */
export async function changeStatusAction(
  _previous: ChangeStatusState | null,
  formData: FormData,
): Promise<ChangeStatusState> {
  try {
    const { team, member } = await requireSessionRole("member");
    const ideaId = formText(formData, "ideaId");
    const result = await changeIdeaStatus(
      getDb(),
      team.id,
      `member:${member.id}`,
      ideaId,
      formText(formData, "status"),
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
