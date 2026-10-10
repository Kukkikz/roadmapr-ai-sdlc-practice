import { z } from "zod";

/**
 * Words that are (or may become) top-level routes, so a Team slug can never shadow them (G6).
 * `/{team-slug}/{board-slug}` shares the first path segment with these.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "create",
  "dashboard",
  "ideas",
  "join",
  "login",
  "logout",
  "new",
  "roadmap",
  "settings",
  "signin",
  "signup",
  "static",
]);

export const SLUG_LIMITS = { min: 2, max: 40 } as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/** A Team or Board slug (G6): lowercase letters, digits and single hyphens, not reserved. */
export const slugSchema = z
  .string({ error: "Enter a slug." })
  .trim()
  .min(SLUG_LIMITS.min, `Slug must be at least ${SLUG_LIMITS.min} characters.`)
  .max(SLUG_LIMITS.max, `Slug must be ${SLUG_LIMITS.max} characters or fewer.`)
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens.")
  .refine((slug) => !isReservedSlug(slug), "This slug is reserved. Choose another.");
