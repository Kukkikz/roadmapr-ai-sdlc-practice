import Link from "next/link";
import { notFound } from "next/navigation";
import { VoteCount } from "@/components/board/vote-count";
import { Badge } from "@/components/ui/badge";
import { getIdea, listComments } from "@/data";
import { getDb } from "@/db";
import { isMemberActor } from "@/lib/actor";
import { getVisibleBoard } from "@/lib/board-view";
import { formatDate } from "@/lib/format";
import { STATUS_LABELS, statusVariant } from "@/lib/status";
import { cn } from "@/lib/utils";

export default async function IdeaPage({
  params,
}: PageProps<"/[teamSlug]/[boardSlug]/ideas/[ideaId]">) {
  const { teamSlug, boardSlug, ideaId } = await params;
  const found = await getVisibleBoard(teamSlug, boardSlug);
  if (!found) notFound();
  const { board, team } = found;

  const db = getDb();
  // Scoped to this Board, and hidden Ideas resolve to null for Visitors (G2).
  const idea = await getIdea(db, ideaId, { boardId: board.id });
  if (!idea) notFound();
  const comments = await listComments(db, idea.id);

  return (
    <article className="mx-auto flex max-w-[720px] flex-col gap-8">
      <Link
        href={`/${team.slug}/${board.slug}`}
        className="w-fit rounded-sm text-link underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Back to {board.name}
      </Link>

      <header className="flex gap-4">
        <VoteCount count={idea.voteCount} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h1 className="text-[32px] leading-[1.2] text-ink">{idea.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(idea.status)}>{STATUS_LABELS[idea.status]}</Badge>
            {idea.tags.map((tag) => (
              <Badge key={tag.id}>{tag.name}</Badge>
            ))}
          </div>
          <p className="text-[13px] text-muted-foreground">
            {idea.authorName ?? "Anonymous"} · {formatDate(idea.createdAt)}
          </p>
        </div>
      </header>

      {idea.description ? (
        <p className="text-base whitespace-pre-wrap text-body">{idea.description}</p>
      ) : null}

      <section aria-labelledby="comments-heading" className="flex flex-col gap-4">
        <h2 id="comments-heading" className="text-2xl text-ink">
          Comments
        </h2>
        {comments.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {comments.map((comment) => {
              const fromTeam = isMemberActor(comment.actorId);
              return (
                <li
                  key={comment.id}
                  className={cn(
                    "flex flex-col gap-2 p-4 text-sm text-body",
                    fromTeam ? "rounded-md bg-cream text-ink" : "border-b border-border",
                  )}
                >
                  <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
                    {fromTeam ? <Badge variant="open">Team</Badge> : null}
                    {comment.authorName ?? (fromTeam ? team.name : "Anonymous")}
                    <span className="font-normal text-muted-foreground">
                      {formatDate(comment.createdAt)}
                    </span>
                  </p>
                  <p className="whitespace-pre-wrap">{comment.body}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-body">No comments yet.</p>
        )}
      </section>
    </article>
  );
}
