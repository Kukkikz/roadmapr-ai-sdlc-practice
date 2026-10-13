import { IdeaStatusForm } from "@/components/team/idea-status-form";
import { Badge } from "@/components/ui/badge";
import type { IdeaStatus } from "@/db/schema";

export type QueueIdea = {
  id: string;
  title: string;
  status: IdeaStatus;
  hidden: boolean;
  createdLabel: string;
  boardName: string;
  boardSlug: string;
};

/**
 * The "To review" section of the dashboard (US-5.5): Ideas nobody on the Team has looked at,
 * newest first. Opening an Idea, or changing its status, tagging or hiding it, takes it off the
 * list. The status control is the dashboard half of US-5.1. Links are plain anchors for the same
 * reason as the Boards list.
 */
export function ModerationQueue({
  teamSlug,
  ideas,
  more = false,
}: {
  teamSlug: string;
  ideas: QueueIdea[];
  /** There are more unreviewed Ideas than are listed. */
  more?: boolean;
}) {
  return (
    <section aria-labelledby="queue-title" className="flex flex-col gap-4">
      <h2 id="queue-title" className="text-2xl text-ink">
        To review
      </h2>
      {ideas.length > 0 ? (
        <ul aria-label="Ideas to review" className="flex flex-col divide-y divide-hairline">
          {ideas.map((idea) => (
            <li key={idea.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/${teamSlug}/${idea.boardSlug}/ideas/${idea.id}`}
                  className="rounded-sm text-base font-medium text-link underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {idea.title}
                </a>
                {idea.hidden ? <Badge>Hidden</Badge> : null}
              </div>
              <p className="text-[13px] text-muted-foreground">
                {idea.boardName} · {idea.createdLabel}
              </p>
              <IdeaStatusForm ideaId={idea.id} status={idea.status} title={idea.title} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-base text-body">Nothing to review. New Ideas will show up here.</p>
      )}
      {more ? (
        <p className="text-sm text-muted-foreground">
          Showing the newest {ideas.length}. Review some to see older Ideas.
        </p>
      ) : null}
    </section>
  );
}
