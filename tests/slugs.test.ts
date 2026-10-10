import { describe, expect, it } from "vitest";
import { isReservedSlug, RESERVED_SLUGS, slugSchema } from "@/lib/slugs";

describe("reserved slugs (G6)", () => {
  it("covers the routes the spec names", () => {
    for (const word of ["login", "api", "dashboard", "join"]) {
      expect(RESERVED_SLUGS.has(word)).toBe(true);
      expect(slugSchema.safeParse(word).success).toBe(false);
    }
  });

  it("is case-insensitive in isReservedSlug", () => {
    expect(isReservedSlug("Login")).toBe(true);
    expect(isReservedSlug("acme")).toBe(false);
  });

  it("rejects a reserved word even with surrounding spaces", () => {
    expect(slugSchema.safeParse("  api ").success).toBe(false);
  });
});

describe("slugSchema", () => {
  it.each(["acme", "my-team", "team-2", "a1"])("accepts %s", (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(true);
  });

  it.each([
    "",
    "a",
    "Acme",
    "my team",
    "my_team",
    "-acme",
    "acme-",
    "ac--me",
    "ac/me",
    "../etc",
    "x".repeat(41),
    "ünï",
  ])("rejects %j", (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(false);
  });

  it("trims before checking", () => {
    expect(slugSchema.parse("  acme ")).toBe("acme");
  });
});
