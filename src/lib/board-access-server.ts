import { cookies } from "next/headers";
import type { BoardAccess } from "./board-access";
import { signBoardGrants, verifyBoardGrants, type BoardGrant } from "./board-grants";
import { getEnv } from "./env";
import { getSession } from "./session";

export const BOARD_ACCESS_COOKIE = "roadmapr_boards";
// Browsers cap cookie lifetime at 400 days.
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/** The Private-board grants in this request's cookie. Read-only, so safe in Server Components. */
export async function readBoardGrants(): Promise<BoardGrant[]> {
  const store = await cookies();
  return verifyBoardGrants(store.get(BOARD_ACCESS_COOKIE)?.value, getEnv().SESSION_SECRET);
}

/** What the current requester brings to a Board: their Session's Team and their cookie grants. */
export async function readBoardAccess(): Promise<BoardAccess> {
  const session = await getSession();
  return { teamId: session?.team.id, grants: await readBoardGrants() };
}

/** Stores the grants: signed and HTTP-only, so page scripts can neither read nor forge them. */
export async function setBoardGrantsCookie(grants: BoardGrant[]): Promise<void> {
  const store = await cookies();
  store.set(BOARD_ACCESS_COOKIE, signBoardGrants(grants, getEnv().SESSION_SECRET), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}
