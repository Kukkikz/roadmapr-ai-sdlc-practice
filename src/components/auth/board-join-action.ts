"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { readBoardGrants, setBoardGrantsCookie } from "@/lib/board-access-server";
import { joinBoardWithLink } from "@/lib/board-share-links";
import { getClientIp } from "@/lib/client-ip";
import { formText } from "@/lib/form-data";

export type JoinBoardFormState = { error: "invalid" | "rate_limited" };

/**
 * Thin wrapper for the "Continue" button on a Board share link (US-2.4): reads the request,
 * delegates to `joinBoardWithLink`, stores the grant in the signed cookie and sends the Visitor to
 * the Board. Reachable by direct POST, so every check lives in the lib.
 */
export async function joinBoardAction(
  _previous: JoinBoardFormState | null,
  formData: FormData,
): Promise<JoinBoardFormState> {
  const result = await joinBoardWithLink(
    getDb(),
    await getClientIp(),
    formText(formData, "token"),
    await readBoardGrants(),
  );
  if (!result.ok) return { error: result.error };
  await setBoardGrantsCookie(result.grants);
  redirect(result.path);
}
