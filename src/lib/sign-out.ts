import { deleteSession } from "@/data";
import type { Db } from "@/data";
import { hashToken } from "./link-token";
import { clearSessionCookie, readSessionToken } from "./session";

/** Ends this browser's Session on the server first, then clears the cookie (US-3.5). */
export async function signOut(db: Db): Promise<void> {
  const token = await readSessionToken();
  if (token) await deleteSession(db, hashToken(token));
  await clearSessionCookie();
}
