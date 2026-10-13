"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { setIdeaTagsAction } from "@/components/team/idea-tags-actions";
import { Button } from "@/components/ui/button";
import { tagMarkerClass } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

type BoardTag = { id: string; name: string; color: string };

/**
 * A Member's Tag control on the Idea page (US-5.2): tick the Board's Tags that apply, then save.
 * The server checks the role, the Team and that every Tag belongs to the Board again, so this
 * form is only a convenience. It submits through `onSubmit` so React does not reset the
 * checkboxes after the action.
 */
export function IdeaTagsForm({
  ideaId,
  boardTags,
  appliedIds,
}: {
  ideaId: string;
  boardTags: BoardTag[];
  appliedIds: string[];
}) {
  const [state, run, pending] = useActionState(setIdeaTagsAction, null);
  if (boardTags.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This Board has no Tags yet. Add some from the dashboard.
      </p>
    );
  }
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => run(formData));
  };
  return (
    <form onSubmit={onSubmit} aria-label="Tags" className="flex flex-col gap-2">
      <input type="hidden" name="ideaId" value={ideaId} />
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Tags on this Idea</legend>
        <span aria-hidden className="text-sm font-medium text-ink">
          Tags
        </span>
        {boardTags.map((tag) => (
          <label
            key={tag.id}
            className={cn(
              "inline-flex items-center gap-2 rounded-sm border-l-4 bg-muted px-2 py-1 text-[13px] font-medium text-body",
              tagMarkerClass(tag.color),
            )}
          >
            <input
              type="checkbox"
              name="tagId"
              value={tag.id}
              defaultChecked={appliedIds.includes(tag.id)}
            />
            {tag.name}
          </label>
        ))}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save tags"}
        </Button>
      </fieldset>
      {state?.ok ? (
        <p role="status" className="text-sm text-muted-foreground">
          Tags saved.
        </p>
      ) : null}
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.error === "forbidden"
            ? "Only Team Members can change Tags."
            : state.error === "not-found"
              ? "This Idea no longer exists."
              : "Pick only this Board's Tags."}
        </p>
      ) : null}
    </form>
  );
}
