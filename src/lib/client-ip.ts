import { isIP } from "node:net";
import { headers } from "next/headers";

const HEADERS = ["x-vercel-forwarded-for", "x-forwarded-for", "x-real-ip"] as const;

/**
 * The requester's IP address, or "unknown". Used for rate limiting only (NF6): callers hash it
 * into a rate-limit key and never store or log it. Behind Vercel the platform sets
 * `x-vercel-forwarded-for` itself; Phase 7 verifies this against a real deployment. Requests
 * with no readable address all share the "unknown" bucket, which fails closed: they hit the
 * IP limits together.
 */
export function clientIpFrom(requestHeaders: Headers): string {
  for (const name of HEADERS) {
    const candidate = requestHeaders.get(name)?.split(",")[0]?.trim();
    if (candidate && isIP(candidate)) return candidate;
  }
  return "unknown";
}

/** `clientIpFrom` for the current request (server actions and route handlers). */
export async function getClientIp(): Promise<string> {
  return clientIpFrom(await headers());
}
