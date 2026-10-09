import { z } from "zod";
import { IDEA_STATUSES, type IdeaStatus } from "@/db/schema";

export type BoardQuery = {
  sort: "top" | "newest";
  status?: IdeaStatus;
  tag?: string;
  q?: string;
};

const querySchema = z.object({
  sort: z.enum(["top", "newest"]).catch("top"),
  status: z.enum(IDEA_STATUSES).optional().catch(undefined),
  tag: z.string().min(1).max(64).optional().catch(undefined),
  q: z
    .string()
    .trim()
    .max(100)
    .transform((value) => value || undefined)
    .optional()
    .catch(undefined),
});

/** Reads a Board page's `searchParams`. Anything invalid falls back to the default. */
export function parseBoardQuery(raw: Record<string, string | string[] | undefined>): BoardQuery {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return querySchema.parse({
    sort: first(raw.sort),
    status: first(raw.status),
    tag: first(raw.tag),
    q: first(raw.q),
  });
}

/** A Board URL with `patch` applied to `query`; defaults (sort=top, no filters) are left out. */
export function boardHref(
  basePath: string,
  query: BoardQuery,
  patch: Partial<{ [K in keyof BoardQuery]: BoardQuery[K] | null }> = {},
): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.sort && next.sort !== "top") params.set("sort", next.sort);
  if (next.status) params.set("status", next.status);
  if (next.tag) params.set("tag", next.tag);
  if (next.q) params.set("q", next.q);
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}
