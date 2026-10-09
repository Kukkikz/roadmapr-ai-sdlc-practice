import { notFound } from "next/navigation";
import { EmptyState } from "@/components/board/empty-state";
import { IdeaCard } from "@/components/board/idea-card";
import { listRoadmapIdeas, ROADMAP_STATUSES } from "@/data";
import { getDb } from "@/db";
import { getVisibleBoard } from "@/lib/board-view";
import { STATUS_LABELS } from "@/lib/status";

export default async function RoadmapPage({
  params,
}: PageProps<"/[teamSlug]/[boardSlug]/roadmap">) {
  const { teamSlug, boardSlug } = await params;
  const found = await getVisibleBoard(teamSlug, boardSlug);
  if (!found) notFound();
  const { board, team } = found;

  const roadmap = await listRoadmapIdeas(getDb(), board.id);
  const basePath = `/${team.slug}/${board.slug}`;
  const empty = ROADMAP_STATUSES.every((status) => roadmap[status].length === 0);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-[32px] leading-[1.2] text-ink">Roadmap</h1>
      {empty ? (
        <EmptyState title="Nothing on the roadmap yet">
          Ideas the team plans, starts or ships will appear here.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-3 items-start gap-6">
          {ROADMAP_STATUSES.map((status) => (
            <section
              key={status}
              aria-labelledby={`roadmap-${status}`}
              className="flex flex-col gap-4 rounded-lg bg-muted p-4"
            >
              <h2 id={`roadmap-${status}`} className="text-xl font-medium text-ink">
                {STATUS_LABELS[status]}
              </h2>
              {roadmap[status].length > 0 ? (
                <ul className="flex flex-col gap-4">
                  {roadmap[status].map((idea) => (
                    <li key={idea.id}>
                      <IdeaCard idea={idea} href={`${basePath}/ideas/${idea.id}`} compact />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body">No ideas here yet.</p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
