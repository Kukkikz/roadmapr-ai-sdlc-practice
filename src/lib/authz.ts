import type { MemberRole } from "@/db/schema";
import { getSession } from "./session";

type SessionInfo = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Why access was refused. Callers show every reason as the same not-found or forbidden result. */
export class AuthorizationError extends Error {
  constructor(readonly reason: "signed_out" | "wrong_team" | "forbidden") {
    super(`Not authorised: ${reason}`);
    this.name = "AuthorizationError";
  }
}

/**
 * Pure check behind `requireRole` (US-3.6). An Owner may do everything a Member may; a Member
 * may not do Owner-only things; nobody acts on a Team they do not belong to.
 */
export function authorize(session: SessionInfo | null, teamId: string, role: MemberRole) {
  if (!session) throw new AuthorizationError("signed_out");
  if (session.team.id !== teamId || session.member.teamId !== teamId) {
    throw new AuthorizationError("wrong_team");
  }
  if (role === "owner" && session.member.role !== "owner") {
    throw new AuthorizationError("forbidden");
  }
  return session;
}

/**
 * The first line of every protected Server Action (US-3.6). Returns the signed-in Member and
 * Team, or throws `AuthorizationError`. `teamId` must come from the server's own data (the
 * Board or Idea being changed), never from a form field.
 */
export async function requireRole(teamId: string, role: MemberRole) {
  return authorize(await getSession(), teamId, role);
}
