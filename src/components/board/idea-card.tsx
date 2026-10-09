import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { IdeaStatus } from "@/db/schema";
import { plural } from "@/lib/format";
import { STATUS_LABELS, statusVariant } from "@/lib/status";
import { VoteButton } from "./vote-button";

export type IdeaCardData = {
  id: string;
  title: string;
  status: IdeaStatus;
  voteCount: number;
  commentCount: number;
  tags: { id: string; name: string }[];
  /** Whether the current Visitor has already upvoted it. */
  voted: boolean;
};

export function IdeaCard({
  idea,
  href,
  compact = false,
}: {
  idea: IdeaCardData;
  href: string;
  /** Roadmap cards show title, votes and tags only. */
  compact?: boolean;
}) {
  return (
    <article className="flex gap-4 rounded-md border border-border bg-card p-4">
      <VoteButton ideaId={idea.id} voteCount={idea.voteCount} voted={idea.voted} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="text-lg font-medium text-ink">
          <Link
            href={href}
            className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {idea.title}
          </Link>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {compact ? null : (
            <Badge variant={statusVariant(idea.status)}>{STATUS_LABELS[idea.status]}</Badge>
          )}
          {idea.tags.map((tag) => (
            <Badge key={tag.id}>{tag.name}</Badge>
          ))}
          {compact ? null : (
            <span className="ml-auto inline-flex items-center gap-1 text-[13px] text-muted-foreground">
              <MessageSquare aria-hidden className="size-3.5" />
              {plural(idea.commentCount, "comment")}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
