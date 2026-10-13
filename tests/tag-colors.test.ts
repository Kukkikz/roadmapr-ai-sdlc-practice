import { describe, expect, it } from "vitest";
import { TAG_COLORS, tagMarkerClass } from "@/lib/tag-colors";

describe("tagMarkerClass (US-5.2)", () => {
  it("gives every palette colour its own left-border class", () => {
    const classes = TAG_COLORS.map(tagMarkerClass);
    expect(new Set(classes).size).toBe(TAG_COLORS.length);
    for (const cls of classes) expect(cls).toMatch(/^border-l-/);
  });

  it("falls back to grey for a stored colour outside the palette", () => {
    expect(tagMarkerClass("#ff00ff")).toBe(tagMarkerClass("grey"));
  });
});
