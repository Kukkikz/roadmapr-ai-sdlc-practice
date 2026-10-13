import type { Metadata } from "next";

const SITE_NAME = "Roadmapr";
const MAX_DESCRIPTION = 160;

type Visibility = "public" | "private";

/** One line of plain text, cut at a word boundary with an ellipsis when longer than `max`. */
export function summarize(text: string | null | undefined, max = MAX_DESCRIPTION): string | null {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return null;
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * Title, description and Open Graph tags for a public page (NF4). A Private board is only
 * reachable with a link, so its pages ask search engines to stay away; they get the same tags
 * (the viewer already has access) plus `noindex`.
 */
export function pageMetadata(input: {
  title: string;
  description: string;
  visibility: Visibility;
}): Metadata {
  return {
    title: input.title,
    description: input.description,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: input.title,
      description: input.description,
    },
    ...(input.visibility === "private" ? { robots: { index: false, follow: false } } : {}),
  };
}

export function boardMetadata(
  team: { name: string },
  board: { name: string; description: string | null; visibility: Visibility },
  section?: "Roadmap",
): Metadata {
  const title = `${section ? `${section} · ` : ""}${board.name} · ${team.name}`;
  const fallback = section
    ? `What ${team.name} is planning, building and has shipped for ${board.name}.`
    : `Share ideas and vote on what ${team.name} builds next for ${board.name}.`;
  return pageMetadata({
    title,
    description: summarize(board.description) ?? fallback,
    visibility: board.visibility,
  });
}

export function ideaMetadata(
  team: { name: string },
  board: { name: string; visibility: Visibility },
  idea: { title: string; description: string | null },
): Metadata {
  return pageMetadata({
    title: `${idea.title} · ${board.name} · ${team.name}`,
    description:
      summarize(idea.description) ?? `An idea for ${board.name} from ${team.name}'s Board.`,
    visibility: board.visibility,
  });
}
