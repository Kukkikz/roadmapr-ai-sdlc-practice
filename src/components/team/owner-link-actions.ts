"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { AuthorizationError, requireSessionRole } from "@/lib/authz";
import { replaceOwnerLink } from "@/lib/owner-links";

export type ReplaceOwnerLinkState =
  | {
      ok: true;
      /** `/login/<token>`. Returned once, in this response only; the server keeps just its hash. */
      ownerLinkPath: string;
    }
  | { ok: false; error: "forbidden" };

/**
 * Thin wrapper: a signed-in Owner replaces their own Owner link (US-3.2). The first line is
 * `requireSessionRole` (US-3.6); both the Team and the Member come from the Session, never from
 * the request, so an Owner can only ever replace their own link.
 */
export async function replaceOwnerLinkAction(): Promise<ReplaceOwnerLinkState> {
  try {
    const { team, member } = await requireSessionRole("owner");
    const link = await replaceOwnerLink(getDb(), team.id, member.id);
    if (!link) return { ok: false, error: "forbidden" };
    // There is no list to refresh, but without this Next.js re-rendered the dashboard after the
    // action in a way that failed with an InvariantError about the cookies object (seen in dev).
    revalidatePath("/dashboard");
    return { ok: true, ownerLinkPath: `/login/${link.token}` };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
}
