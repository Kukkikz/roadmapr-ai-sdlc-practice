"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { AuthorizationError, requireSessionRole } from "@/lib/authz";
import { formText } from "@/lib/form-data";
import { clearSessionCookie } from "@/lib/session";
import { removeTeamMember } from "@/lib/team-members";

/**
 * An Owner removes a Member of their own Team (US-3.4). The first line is `requireSessionRole`
 * (US-3.6); `memberId` comes from the form, so `removeTeamMember` only honours a current Member
 * of the Session's Team. Anything else (another Team's Member, the last Owner, a made-up id) is
 * ignored the same way, so the response tells nobody anything.
 */
export async function removeMemberAction(formData: FormData): Promise<void> {
  try {
    const { team } = await requireSessionRole("owner");
    const memberId = formText(formData, "memberId");
    if (memberId) await removeTeamMember(getDb(), team.id, memberId);
    revalidatePath("/dashboard");
  } catch (error) {
    if (error instanceof AuthorizationError) return;
    throw error;
  }
}

/**
 * A Member leaves their Team (US-3.7): the same soft removal as US-3.4, applied to oneself, which
 * also ends their Sessions on every device. The last Owner cannot leave, so nothing changes for
 * them. Afterwards the cookie is cleared and they go to the home page.
 */
export async function leaveTeamAction(): Promise<void> {
  try {
    const { team, member } = await requireSessionRole("member");
    const result = await removeTeamMember(getDb(), team.id, member.id);
    if (result === "last_owner") {
      revalidatePath("/dashboard");
      return;
    }
  } catch (error) {
    if (error instanceof AuthorizationError) return;
    throw error;
  }
  await clearSessionCookie();
  redirect("/");
}
