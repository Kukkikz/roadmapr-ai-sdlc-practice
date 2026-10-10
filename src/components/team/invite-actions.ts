"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { AuthorizationError, requireSessionRole } from "@/lib/authz";
import { formText } from "@/lib/form-data";
import { createInviteLink, revokeInviteLink } from "@/lib/invite-links";

export type GenerateInviteState =
  | {
      ok: true;
      /** `/join/<token>`. Returned once, in this response only; the server keeps just its hash. */
      invitePath: string;
      expiresAt: string;
    }
  | { ok: false; error: "forbidden" };

/**
 * Thin wrapper: an Owner makes a Member invite link for their own Team (US-3.3). The first line
 * is `requireSessionRole` (US-3.6); the Team comes from the Session, never from the request.
 */
export async function generateInviteAction(): Promise<GenerateInviteState> {
  try {
    const { team } = await requireSessionRole("owner");
    const link = await createInviteLink(getDb(), team.id);
    revalidatePath("/dashboard");
    return { ok: true, invitePath: `/join/${link.token}`, expiresAt: link.expiresAt.toISOString() };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
}

/**
 * An Owner revokes one of their own Team's invite links (US-3.3). Posted from a plain form, so
 * it returns nothing; the list refreshes. A link that is not this Team's invite link is ignored
 * exactly like a missing one, so ids of other Teams' links tell nobody anything.
 */
export async function revokeInviteAction(formData: FormData): Promise<void> {
  try {
    const { team } = await requireSessionRole("owner");
    const linkId = formText(formData, "linkId");
    if (linkId) await revokeInviteLink(getDb(), team.id, linkId);
    revalidatePath("/dashboard");
  } catch (error) {
    if (error instanceof AuthorizationError) return;
    throw error;
  }
}
