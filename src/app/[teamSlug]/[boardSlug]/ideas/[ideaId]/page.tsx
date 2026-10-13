import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentForm } from "@/components/board/comment-form";
import { TagChip } from "@/components/board/tag-chip";
import { VoteButton } from "@/components/board/vote-button";
import { HideToggle } from "@/components/team/hide-toggle";
import { IdeaStatusForm } from "@/components/team/idea-status-form";
import { IdeaTagsForm } from "@/components/team/idea-tags-form";
import { Badge } from "@/components/ui/badge";
import { getIdea, hasVoted, listComments, listTags, markIdeaReviewed } from "@/data";
import { getDb } from "@/db";
import { getVisibleBoard } from "@/lib/board-view";
import { formatDate } from "@/lib/format";
import { ideaMetadata } from "@/lib/seo";
import { postingAsFor } from "@/lib/posting-as";
import { getSession } from "@/lib/session";
import { STATUS_LABELS, statusVariant } from "@/lib/status";
import { readVisitor } from "@/lib/visitor";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: PageProps<"/[teamSlug]/[boardSlug]/ideas/[ideaId]">): Promise<Metadata> {
  const { teamSlug, boardSlug, ideaId } = await params;
  const found = await getVisibleBoard(teamSlug, boardSlug);
  if (!found) return {};
  // Public lookup only: a hidden Idea never lends its title to the tab or a link preview (G2).
  const idea = await getIdea(getDb(), ideaId, { boardId: found.board.id });
  return idea ? ideaMetadata(found.team, found.board, idea) : {};
}

export default async function IdeaPage({
  params,
}: PageProps<"/[teamSlug]/[boardSlug]/ideas/[ideaId]">) {
  const { teamSlug, boardSlug, ideaId } = await params;
  const found = await getVisibleBoard(teamSlug, boardSlug);
  if (!found) notFound();
  const { board, team } = found;

  const db = getDb();
  // Only a Member of this Board's own Team gets the Member controls (US-5.1, US-5.3).
  const isTeamMember = (await getSession())?.team.id === team.id;
  // Scoped to this Board. Hidden Ideas and Comments resolve only for the Team's Members (G2).
  const idea = await getIdea(db, ideaId, { boardId: board.id, includeHidden: isTeamMember });
  if (!idea) notFound();
  // A deliberate write during a GET: opening is the review. Keep plain links to this page for
  // Members (no prefetch) so only a real visit counts.
  // Opening an Idea as a Member of its Team takes it off the moderation queue (US-5.5).
  if (isTeamMember && !idea.reviewedAt) await markIdeaReviewed(db, idea.id);
  const comments = await listComments(db, idea.id, { includeHidden: isTeamMember });
  const visitor = await readVisitor();
  const voted = visitor ? await hasVoted(db, idea.id, visitor.actorId) : false;

  return (
    <article className="mx-auto flex max-w-[720px] flex-col gap-8">
      <Link
        href={`/${team.slug}/${board.slug}`}
        className="w-fit rounded-sm text-link underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Back to {board.name}
      </Link>

      <header className="flex gap-4">
        <VoteButton ideaId={idea.id} voteCount={idea.voteCount} voted={voted} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h1 className="text-[32px] leading-[1.2] text-ink">{idea.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(idea.status)}>{STATUS_LABELS[idea.status]}</Badge>
            {idea.hidden ? <Badge>Hidden</Badge> : null}
            {idea.tags.map((tag) => (
              <TagChip key={tag.id} name={tag.name} color={tag.color} />
            ))}
          </div>
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            {idea.authorTeamId === team.id ? <Badge variant="open">Team</Badge> : null}
            <span>
              {idea.authorName ?? "Anonymous"} · {formatDate(idea.createdAt)}
            </span>
          </p>
        </div>
      </header>

      {isTeamMember ? (
        <div className="flex flex-col gap-4">
          <IdeaStatusForm ideaId={idea.id} status={idea.status} />
          <HideToggle kind="idea" id={idea.id} hidden={idea.hidden} />
          <IdeaTagsForm
            key={idea.tags.map((tag) => tag.id).join(",")}
            ideaId={idea.id}
            boardTags={await listTags(db, board.id)}
            appliedIds={idea.tags.map((tag) => tag.id)}
          />
        </div>
      ) : null}

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
              // Only a Member of this Board's own Team is shown as the Team (US-5.4).
              const fromTeam = comment.authorTeamId === team.id;
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
                    {comment.authorName ?? "Anonymous"}
                    <span className="font-normal text-muted-foreground">
                      {formatDate(comment.createdAt)}
                    </span>
                  </p>
                  {comment.hidden ? <Badge>Hidden</Badge> : null}
                  <p className="whitespace-pre-wrap">{comment.body}</p>
                  {isTeamMember ? (
                    <HideToggle kind="comment" id={comment.id} hidden={comment.hidden} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-body">No comments yet.</p>
        )}
        {idea.hidden ? (
          <p className="text-sm text-muted-foreground">
            This Idea is hidden. Unhide it to allow votes and new comments.
          </p>
        ) : (
          <CommentForm ideaId={idea.id} postingAs={postingAsFor(visitor, team.id)} />
        )}
      </section>
    </article>
  );
}
