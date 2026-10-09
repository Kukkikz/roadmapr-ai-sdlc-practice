import { describe, expect, it } from "vitest";
import { newAnonId, signAnonId, verifyAnonCookie } from "@/lib/anon-cookie";

const SECRET = "a".repeat(32);

describe("anonymous ID cookie", () => {
  it("round-trips a signed ID", () => {
    const id = newAnonId();
    expect(verifyAnonCookie(signAnonId(id, SECRET), SECRET)).toBe(id);
  });

  it("issues a different ID each time", () => {
    expect(newAnonId()).not.toBe(newAnonId());
  });

  it("rejects a cookie signed with another secret", () => {
    const cookie = signAnonId(newAnonId(), "b".repeat(32));
    expect(verifyAnonCookie(cookie, SECRET)).toBeNull();
  });

  it("rejects a tampered ID (a Visitor cannot take over another Actor)", () => {
    const [, signature] = signAnonId(newAnonId(), SECRET).split(".");
    expect(verifyAnonCookie(`${newAnonId()}.${signature}`, SECRET)).toBeNull();
  });

  it("rejects a tampered or truncated signature", () => {
    const cookie = signAnonId(newAnonId(), SECRET);
    expect(verifyAnonCookie(`${cookie}x`, SECRET)).toBeNull();
    expect(verifyAnonCookie(cookie.slice(0, -2), SECRET)).toBeNull();
  });

  it.each([undefined, "", "no-dot", ".", "a.", ".b", "a.b.c"])(
    "rejects malformed value %j",
    (value) => {
      expect(verifyAnonCookie(value, SECRET)).toBeNull();
    },
  );

  it("does not accept a member-style ID or an ID containing a separator", () => {
    expect(verifyAnonCookie(signAnonId("member:1", SECRET), SECRET)).toBeNull();
    expect(verifyAnonCookie(signAnonId("a.b", SECRET), SECRET)).toBeNull();
  });
});
