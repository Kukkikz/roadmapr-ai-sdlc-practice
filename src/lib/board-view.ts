import { connection } from "next/server";
import { cache } from "react";
import { getBoardBySlugs } from "@/data";
import { getDb } from "@/db";
import { canAccessBoard } from "./board-access";
import { readBoardAccess } from "./board-access-server";

/**
 * Resolves `/{team-slug}/{board-slug}` for the current requester, or null. A Board the
 * requester may not see is indistinguishable from one that does not exist (G3). Memoised
 * per request so the layout and the page share one query.
 */
export const getVisibleBoard = cache(async (teamSlug: string, boardSlug: string) => {
  // Opts into request-time rendering: this is live database data, not part of the static shell.
  await connection();
  const found = await getBoardBySlugs(getDb(), teamSlug, boardSlug);
  if (!found) return null;
  if (!(await canAccessBoard(getDb(), found.board, await readBoardAccess()))) return null;
  return found;
});
