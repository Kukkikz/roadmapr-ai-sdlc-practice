import { describe, expect, it, vi } from "vitest";
import type { MemberRole } from "@/db/schema";

const sessionRef = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sessionRef.current }));

const { AuthorizationError, authorize, requireRole } = await import("@/lib/authz");

const sessionOf = (teamId: string, role: MemberRole, memberTeamId = teamId) =>
  ({
    member: { id: `m-${role}`, teamId: memberTeamId, role, displayName: "X", removedAt: null },
    team: { id: teamId, name: "T", slug: "t" },
  }) as never;

const reason = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof AuthorizationError ? error.reason : "other error";
  }
  return "allowed";
};

describe("authorize (US-3.6)", () => {
  it("refuses when nobody is signed in", () => {
    expect(reason(() => authorize(null, "A", "member"))).toBe("signed_out");
    expect(reason(() => authorize(null, "A", "owner"))).toBe("signed_out");
  });

  it("lets an Owner do Owner and Member things on their own Team", () => {
    expect(reason(() => authorize(sessionOf("A", "owner"), "A", "owner"))).toBe("allowed");
    expect(reason(() => authorize(sessionOf("A", "owner"), "A", "member"))).toBe("allowed");
  });

  it("lets a Member do Member things but never Owner-only things", () => {
    expect(reason(() => authorize(sessionOf("A", "member"), "A", "member"))).toBe("allowed");
    expect(reason(() => authorize(sessionOf("A", "member"), "A", "owner"))).toBe("forbidden");
  });

  it("never lets a Member or Owner of Team A act on Team B", () => {
    for (const role of ["member", "owner"] as const) {
      expect(reason(() => authorize(sessionOf("A", role), "B", "member"))).toBe("wrong_team");
      expect(reason(() => authorize(sessionOf("A", role), "B", "owner"))).toBe("wrong_team");
    }
  });

  it("refuses if the Session's Team and its Member's Team disagree", () => {
    expect(reason(() => authorize(sessionOf("A", "owner", "B"), "A", "member"))).toBe("wrong_team");
  });

  it("returns the Member and Team it authorised", () => {
    const session = sessionOf("A", "owner");
    expect(authorize(session, "A", "owner")).toBe(session);
  });
});

describe("requireRole", () => {
  it("reads the current Session and throws AuthorizationError when refused", async () => {
    sessionRef.current = null;
    await expect(requireRole("A", "member")).rejects.toBeInstanceOf(AuthorizationError);
    sessionRef.current = sessionOf("A", "member");
    await expect(requireRole("A", "owner")).rejects.toMatchObject({ reason: "forbidden" });
    await expect(requireRole("B", "member")).rejects.toMatchObject({ reason: "wrong_team" });
    await expect(requireRole("A", "member")).resolves.toMatchObject({ team: { id: "A" } });
  });
});
