import { describe, expect, it } from "vitest";
import { clientIpFrom } from "@/lib/client-ip";

const h = (init: Record<string, string>) => new Headers(init);

describe("clientIpFrom", () => {
  it("uses the first x-forwarded-for entry", () => {
    expect(clientIpFrom(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("prefers x-vercel-forwarded-for, which the platform sets itself", () => {
    expect(
      clientIpFrom(
        h({ "x-vercel-forwarded-for": "198.51.100.2", "x-forwarded-for": "203.0.113.7" }),
      ),
    ).toBe("198.51.100.2");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIpFrom(h({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("reads IPv6", () => {
    expect(clientIpFrom(h({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("returns 'unknown' when there is no usable address", () => {
    expect(clientIpFrom(h({}))).toBe("unknown");
    expect(clientIpFrom(h({ "x-forwarded-for": "not-an-ip" }))).toBe("unknown");
    expect(clientIpFrom(h({ "x-forwarded-for": "<script>" }))).toBe("unknown");
  });
});
