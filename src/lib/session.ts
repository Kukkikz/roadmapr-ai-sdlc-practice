import { cookies } from "next/headers";
import { connection } from "next/server";
import { findSessionByHash } from "@/data";
import { getDb } from "@/db";
import { hashToken, isTokenShape } from "./link-token";

export const SESSION_COOKIE = "roadmapr_session";

/** Sets the Session cookie: HTTP-only, so page scripts can never read the token. */
export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** The raw Session token in this request's cookie, if it has the right shape. */
export async function readSessionToken(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return isTokenShape(token) ? token : null;
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * The signed-in Member and Team for this request, or null. Read-only, so it is safe in Server
 * Components. A removed Member, an expired Session and a forged cookie all give null (G8).
 */
export async function getSession() {
  // Whether a Session has expired depends on the clock, so render per request, never at build.
  await connection();
  const token = await readSessionToken();
  if (!token) return null;
  const found = await findSessionByHash(getDb(), hashToken(token));
  return found ? { member: found.member, team: found.team } : null;
}
