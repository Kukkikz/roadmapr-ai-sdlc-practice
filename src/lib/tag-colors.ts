/**
 * The Tag colours a Member can pick (SPEC US-5.2). Each maps to a colour already in `DESIGN.md`,
 * so no new token is needed. The class names are written out in full so Tailwind finds them.
 */
export const TAG_COLORS = ["grey", "blue", "green", "yellow", "red"] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export const DEFAULT_TAG_COLOR: TagColor = "grey";

export const TAG_COLOR_LABELS: Record<TagColor, string> = {
  grey: "Grey",
  blue: "Blue",
  green: "Green",
  yellow: "Yellow",
  red: "Red",
};

const MARKER_CLASSES: Record<TagColor, string> = {
  grey: "border-l-border-strong",
  blue: "border-l-info",
  green: "border-l-success",
  yellow: "border-l-status-in-progress",
  red: "border-l-danger",
};

/** The 4px left marker of a Tag chip; a stored value outside the palette falls back to grey. */
export function tagMarkerClass(color: string): string {
  return MARKER_CLASSES[color as TagColor] ?? MARKER_CLASSES[DEFAULT_TAG_COLOR];
}
