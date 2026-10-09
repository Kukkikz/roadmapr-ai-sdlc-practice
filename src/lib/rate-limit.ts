import { createHmac } from "node:crypto";
import { checkRateLimit, purgeRateLimits } from "@/data";
import type { Db } from "@/data";
import { getEnv } from "./env";

export type RateLimitScope = "anon" | "ip";

/** SPEC G5 "Rate limits" table. Every scope listed for an action must pass. */
export const RATE_LIMITS = {
  submit: { limit: 5, windowSeconds: 600, scopes: ["anon", "ip"] },
  comment: { limit: 10, windowSeconds: 600, scopes: ["anon", "ip"] },
  vote: { limit: 60, windowSeconds: 60, scopes: ["ip"] },
  similar: { limit: 30, windowSeconds: 60, scopes: ["ip"] },
  createTeam: { limit: 3, windowSeconds: 3600, scopes: ["ip"] },
} as const satisfies Record<
  string,
  { limit: number; windowSeconds: number; scopes: readonly RateLimitScope[] }
>;

export type RateLimitedAction = keyof typeof RATE_LIMITS;

/**
 * `<action>:<scope>:<hash>`. The value (IP or anonymous ID) is HMAC-hashed, so `rate_limits`
 * never holds a raw IP (NF6) and the stored key cannot be reversed without the secret.
 */
export function rateLimitKey(
  action: RateLimitedAction,
  scope: RateLimitScope,
  value: string,
  secret: string = getEnv().SESSION_SECRET,
): string {
  const digest = createHmac("sha256", secret)
    .update(`rate-limit:${action}:${scope}:${value}`)
    .digest("base64url");
  return `${action}:${scope}:${digest}`;
}

/** Windows older than this are deleted. Longer than every window in `RATE_LIMITS`. */
const KEEP_SECONDS = 24 * 60 * 60;
const PURGE_CHANCE = 0.01;

/**
 * Counts one attempt of `action` and returns whether it may go ahead (G5). Scopes are checked
 * in order and the first refusal stops the check, so a refused cookie does not use up the
 * allowance of the IP behind it. Windows are fixed, so a burst across a boundary can pass up
 * to twice the limit; that is acceptable for abuse control.
 */
export async function enforceRateLimit(
  db: Db,
  action: RateLimitedAction,
  who: { anonId?: string; ip: string },
  now: Date = new Date(),
): Promise<boolean> {
  const { limit, windowSeconds, scopes } = RATE_LIMITS[action];
  let allowed = true;
  for (const scope of scopes) {
    const value = scope === "ip" ? who.ip : who.anonId;
    if (!value) throw new Error(`Rate limit "${action}" needs a ${scope} value.`);
    if (
      !(await checkRateLimit(db, rateLimitKey(action, scope, value), limit, windowSeconds, now))
    ) {
      allowed = false;
      break;
    }
  }
  // Keep the table small without a scheduled job.
  if (Math.random() < PURGE_CHANCE) {
    // Housekeeping must never change the decision or fail the action.
    await purgeRateLimits(db, new Date(now.getTime() - KEEP_SECONDS * 1000)).catch(() => {});
  }
  return allowed;
}
