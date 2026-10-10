import { cookies } from "next/headers";
import { newAnonId, signAnonId, verifyAnonCookie } from "./anon-cookie";
import { getEnv } from "./env";
import { getSession } from "./session";

export const ANON_COOKIE = "roadmapr_anon";
// Browsers cap cookie lifetime at 400 days.
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/**
 * Whoever is acting: an anonymous Visitor (`anon:<id>`) or a signed-in Member (`member:<id>`).
 * `actorId` is the form stored on Ideas, Votes and Comments. `anonId` is the stable per-actor
 * value the rate limiter keys on; for a Member it is the same `member:<id>` string, so a Member
 * never shares an allowance with, or borrows, an anonymous cookie.
 */
export type Visitor = { anonId: string; actorId: string; memberId?: string };

function toVisitor(anonId: string): Visitor {
  return { anonId, actorId: `anon:${anonId}` };
}

function toMember(memberId: string): Visitor {
  const actorId = `member:${memberId}`;
  return { anonId: actorId, actorId, memberId };
}

/**
 * The current Visitor, or null if the browser has no valid anonymous ID yet. Never sets a
 * cookie, so it is safe in Server Components (for example to show whether I already voted).
 * A signed-in Member always acts as `member:<id>`, never as their anonymous cookie (G1); this
 * is the one place that decides.
 */
export async function readVisitor(): Promise<Visitor | null> {
  const session = await getSession();
  if (session) return toMember(session.member.id);
  const store = await cookies();
  const anonId = verifyAnonCookie(store.get(ANON_COOKIE)?.value, getEnv().SESSION_SECRET);
  return anonId ? toVisitor(anonId) : null;
}

/**
 * The current Visitor, issuing a signed, HTTP-only anonymous ID cookie if there is none (or it
 * is invalid or forged). Only for Server Actions and Route Handlers, the places Next.js lets
 * you set cookies, so the ID is issued by the Visitor's first action rather than on first page
 * view. A signed-in Member gets no anonymous cookie at all.
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
