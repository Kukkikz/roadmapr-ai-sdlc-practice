import { describe, expect, it } from "vitest";
import { STATUS_LABELS, statusVariant } from "@/lib/status";
import { IDEA_STATUSES } from "@/db/schema";

describe("status helpers", () => {
  it("labels every status", () => {
    for (const status of IDEA_STATUSES) expect(STATUS_LABELS[status]).toBeTruthy();
  });

  it("maps in_progress to the hyphenated badge variant", () => {
    expect(statusVariant("in_progress")).toBe("in-progress");
    expect(statusVariant("planned")).toBe("planned");
  });
});
