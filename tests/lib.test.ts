import { describe, expect, it } from "vitest";
import { isMemberActor } from "@/lib/actor";
import { canAccessBoard } from "@/lib/board-access";
import { STATUS_LABELS, statusVariant } from "@/lib/status";
import { IDEA_STATUSES } from "@/db/schema";

describe("canAccessBoard", () => {
  it("allows a public Board and refuses a private one (G3)", () => {
    expect(canAccessBoard({ visibility: "public" })).toBe(true);
    expect(canAccessBoard({ visibility: "private" })).toBe(false);
  });
});

describe("isMemberActor", () => {
  it("tells Members from Visitors by the Actor prefix", () => {
    expect(isMemberActor("member:abc")).toBe(true);
    expect(isMemberActor("anon:abc")).toBe(false);
  });
});

describe("status helpers", () => {
  it("labels every status", () => {
    for (const status of IDEA_STATUSES) expect(STATUS_LABELS[status]).toBeTruthy();
  });

  it("maps in_progress to the hyphenated badge variant", () => {
    expect(statusVariant("in_progress")).toBe("in-progress");
    expect(statusVariant("planned")).toBe("planned");
  });
});
