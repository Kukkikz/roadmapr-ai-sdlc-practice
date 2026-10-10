import { describe, expect, it } from "vitest";
import { generateToken, hashToken, isTokenShape } from "@/lib/link-token";

describe("link tokens", () => {
  it("are 43-character URL-safe strings (256 random bits) and never repeat", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(isTokenShape(token)).toBe(true);
    }
  });

  it("hash to a stable 64-character hex digest that is not the token", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(generateToken())).not.toBe(hashToken(token));
  });

  it("isTokenShape rejects anything else", () => {
    for (const bad of [
      "",
      "short",
      "a".repeat(42),
      "a".repeat(44),
      "a/b".padEnd(43, "a"),
      null,
      7,
    ]) {
      expect(isTokenShape(bad)).toBe(false);
    }
  });
});
