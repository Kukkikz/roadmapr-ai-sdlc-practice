import { lt, sql } from "drizzle-orm";
import { rateLimits } from "@/db/schema";
import type { Db } from "./types";

/**
 * Fixed-window counter. Counts this attempt and returns whether it is within `limit` for the
 * window containing `now`. One atomic upsert (no transaction, so it works over Neon's HTTP
 * driver), so concurrent requests are counted exactly. Refused attempts still count, which
 * means hammering a limited action does not reset or shorten its window.
 */
export async function checkRateLimit(
  db: Db,
  key: string,
  limit: number,
  windowSeconds: number,
  now: Date = new Date(),
): Promise<boolean> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  return row.count <= limit;
}

/** Deletes windows that started before `before`. */
export async function purgeRateLimits(db: Db, before: Date): Promise<void> {
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, before));
}
