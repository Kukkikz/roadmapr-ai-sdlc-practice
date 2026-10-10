"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getClientIp } from "@/lib/client-ip";
import { formText } from "@/lib/form-data";
import { redeemLink } from "@/lib/redeem";
import type { RedeemKind } from "@/lib/redeem-input";
import { readSessionToken, setSessionCookie } from "@/lib/session";

export type RedeemFormState = {
  error: "invalid" | "rate_limited" | "invalid_name";
  message?: string;
};

/**
 * Thin wrapper for the "Continue" button: reads the request, delegates to `redeemLink`. Reachable
 * by direct POST, so every check lives there; `kind` comes from the client and is only trusted
 * to pick which kind of link to look for.
 */
export async function redeemAction(
  kind: RedeemKind,
  _previous: RedeemFormState | null,
  formData: FormData,
): Promise<RedeemFormState> {
  if (kind !== "owner" && kind !== "member_invite") return { error: "invalid" };
  const result = await redeemLink(getDb(), await getClientIp(), kind, formText(formData, "token"), {
    displayName: formText(formData, "displayName"),
    previousSessionToken: await readSessionToken(),
  });
  if (!result.ok) {
    return result.error === "invalid_name"
      ? { error: "invalid_name", message: result.message }
      : { error: result.error };
  }
  await setSessionCookie(result.sessionToken, result.expiresAt);
  redirect("/dashboard");
}
