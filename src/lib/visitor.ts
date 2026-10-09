import { cookies } from "next/headers";
import { newAnonId, signAnonId, verifyAnonCookie } from "./anon-cookie";
import { getEnv } from "./env";

export const ANON_COOKIE = "roadmapr_anon";
// Browsers cap cookie lifetime at 400 days.
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/** An anonymous Visitor. `actorId` is the `anon:<id>` form stored on Ideas, Votes and Comments. */
export type Visitor = { anonId: string; actorId: string };

function toVisitor(anonId: string): Visitor {
  return { anonId, actorId: `anon:${anonId}` };
}

/**
 * The current Visitor, or null if the browser has no valid anonymous ID yet. Never sets a
 * cookie, so it is safe in Server Components (for example to show whether I already voted).
 * Phase 4: a signed-in Member acts as `member:<id>` instead (G1); this is the one place to add it.
 */
export async function readVisitor(): Promise<Visitor | null> {
  const store = await cookies();
  const anonId = verifyAnonCookie(store.get(ANON_COOKIE)?.value, getEnv().SESSION_SECRET);
  return anonId ? toVisitor(anonId) : null;
}

/**
 * The current Visitor, issuing a signed, HTTP-only anonymous ID cookie if there is none (or it
 * is invalid or forged). Only for Server Actions and Route Handlers, the places Next.js lets
 * you set cookies, so the ID is issued by the Visitor's first action rather than on first page
 * view.
 */
export async function getVisitor(): Promise<Visitor> {
  const existing = await readVisitor();
  if (existing) return existing;
  const anonId = newAnonId();
  const store = await cookies();
  store.set(ANON_COOKIE, signAnonId(anonId, getEnv().SESSION_SECRET), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return toVisitor(anonId);
}
