"use server";

import { getDb } from "@/db";
import { getClientIp } from "@/lib/client-ip";
import { createTeamWithOwner } from "@/lib/create-team";
import type { CreateTeamFields } from "@/lib/create-team-input";
import { formText } from "@/lib/form-data";
import { readSessionToken, setSessionCookie } from "@/lib/session";

export type CreateTeamState =
  | {
      ok: true;
      teamName: string;
      /** `/login/<token>`. Returned once, in this response only; the server keeps just its hash. */
      ownerLinkPath: string;
    }
  | { ok: false; error: "invalid"; fieldErrors: Partial<Record<CreateTeamFields, string>> }
  | { ok: false; error: "rate_limited" };

/** Thin wrapper: reads the request, delegates to `createTeamWithOwner`, signs the creator in. */
export async function createTeamAction(
  _previous: CreateTeamState | null,
  formData: FormData,
): Promise<CreateTeamState> {
  const result = await createTeamWithOwner(
    getDb(),
    await getClientIp(),
    {
      teamName: formText(formData, "teamName"),
      teamSlug: formText(formData, "teamSlug"),
      boardName: formText(formData, "boardName"),
      displayName: formText(formData, "displayName"),
    },
    { previousSessionToken: await readSessionToken() },
  );
  if (!result.ok) return result;
  await setSessionCookie(result.sessionToken, result.expiresAt);
  return { ok: true, teamName: result.teamName, ownerLinkPath: `/login/${result.ownerToken}` };
}
