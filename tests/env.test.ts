import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const SECRET = "x".repeat(32);

describe("parseEnv", () => {
  it("accepts a minimal valid environment and leaves DATABASE_URL unset", () => {
    const env = parseEnv({ SESSION_SECRET: SECRET });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.NODE_ENV).toBe("development");
  });

  it("accepts a DATABASE_URL", () => {
    const env = parseEnv({
      SESSION_SECRET: SECRET,
      DATABASE_URL: "postgres://user:pass@host.neon.tech/db",
    });
    expect(env.DATABASE_URL).toContain("neon.tech");
  });

  it("rejects a missing SESSION_SECRET", () => {
    expect(() => parseEnv({})).toThrow(/SESSION_SECRET/);
  });

  it("rejects a short SESSION_SECRET", () => {
    expect(() => parseEnv({ SESSION_SECRET: "too-short" })).toThrow(/at least 32/);
  });

  it("rejects a malformed DATABASE_URL", () => {
    expect(() => parseEnv({ SESSION_SECRET: SECRET, DATABASE_URL: "not a url" })).toThrow(
      /DATABASE_URL/,
    );
  });
});
