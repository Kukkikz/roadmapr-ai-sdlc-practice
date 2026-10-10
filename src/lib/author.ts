import type { Visitor } from "./visitor";

/**
 * The display name stored on an Idea or Comment. A signed-in Member always posts under their own
 * display name, taken from the Session, so a typed name cannot pass as a teammate (US-5.4). A
 * Visitor's optional typed name is used as is.
 */
export function authorNameFor(visitor: Visitor, typed: string | null | undefined): string | null {
  if (visitor.memberId) return visitor.displayName ?? null;
  return typed ?? null;
}
