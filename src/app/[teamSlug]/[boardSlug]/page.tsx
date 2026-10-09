import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/board/empty-state";
import { FilterRail } from "@/components/board/filter-rail";
import { IdeaCard } from "@/components/board/idea-card";
import { SearchForm } from "@/components/board/search-form";
import { listIdeas, listTags, votedIdeaIds } from "@/data";
import { getDb } from "@/db";
import { boardHref, parseBoardQuery } from "@/lib/board-query";
import { getVisibleBoard } from "@/lib/board-view";
import { readVisitor } from "@/lib/visitor";

export default async function BoardPage({
  params,
  searchParams,
}: PageProps<"/[teamSlug]/[boardSlug]">) {
  const { teamSlug, boardSlug } = await params;
  const found = await getVisibleBoard(teamSlug, boardSlug);
  if (!found) notFound();
  const { board, team } = found;

  const query = parseBoardQuery(await searchParams);
  const db = getDb();
  const [ideas, tags] = await Promise.all([
    listIdeas(db, {
      boardId: board.id,
      sort: query.sort,
      status: query.status,
      tagId: query.tag,
      search: query.q,
    }),
    listTags(db, board.id),
  ]);

  const visitor = await readVisitor();
  const voted = visitor
    ? await votedIdeaIds(
        db,
        visitor.actorId,
        ideas.map((idea) => idea.id),
      )
    : new Set<string>();

  const basePath = `/${team.slug}/${board.slug}`;
  const filtered = Boolean(query.status || query.tag || query.q);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-[40px] leading-[1.2] text-ink">{board.name}</h1>
        {board.description ? <p className="text-base text-body">{board.description}</p> : null}
      </div>
      <div className="flex items-start gap-8">
        <FilterRail basePath={basePath} query={query} tags={tags} />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <SearchForm basePath={basePath} query={query} />
          {ideas.length > 0 ? (
            <ul className="flex flex-col gap-4" aria-label="Ideas">
              {ideas.map((idea) => (
                <li key={idea.id}>
                  <IdeaCard
                    idea={{ ...idea, voted: voted.has(idea.id) }}
                    href={`${basePath}/ideas/${idea.id}`}
                  />
                </li>
              ))}
            </ul>
          ) : filtered ? (
            <EmptyState title="No ideas match your search">
              <Link
                href={boardHref(basePath, query, { status: null, tag: null, q: null })}
                className="text-link underline-offset-4 underline"
              >
                Clear filters
              </Link>
            </EmptyState>
          ) : (
            <EmptyState title="No ideas yet">
              Ideas that Visitors submit will appear here.
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
