"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { AuthorizationError, requireSessionRole } from "@/lib/authz";
import { deleteTeamConfirmed } from "@/lib/delete-team";
import { formText } from "@/lib/form-data";
import { clearSessionCookie } from "@/lib/session";

export type DeleteTeamState = { ok: false; error: "wrong_confirmation" | "forbidden" };

/**
 * An Owner deletes their own Team after typing its slug (US-3.8). The first line is
 * `requireSessionRole` (US-3.6); the Team comes from the Session, never from the request, and the
 * typed slug is checked again here on the server, so skipping the dialog's disabled button
 * deletes nothing. On success the cookie is cleared and the Owner lands on the "Team deleted" page.
 */
export async function deleteTeamAction(
  _previous: DeleteTeamState | null,
  formData: FormData,
): Promise<DeleteTeamState> {
  try {
    const { team } = await requireSessionRole("owner");
    const result = await deleteTeamConfirmed(getDb(), team, formText(formData, "confirmation"));
    if (result === "wrong_confirmation") return { ok: false, error: "wrong_confirmation" };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  await clearSessionCookie();
  redirect("/team-deleted");
}
