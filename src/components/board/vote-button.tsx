"use client";

import { startTransition, useOptimistic, useRef, useState, useTransition } from "react";
import { ChevronUp } from "lucide-react";
import { toggleVoteAction } from "@/app/[teamSlug]/[boardSlug]/actions";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

type VoteState = { count: number; voted: boolean };

/**
 * The upvote toggle (US-2.2). The count and the pressed state change the moment it is clicked
 * (optimistic) and settle on the server's answer. If the request fails, the optimistic change
 * rolls back and a short message explains why.
 */
export function VoteButton({
  ideaId,
  voteCount,
  voted,
}: {
  ideaId: string;
  voteCount: number;
  voted: boolean;
}) {
  // The last answer from the server; until there is one, the props from the page render.
  const [confirmed, setConfirmed] = useState<VoteState | null>(null);
  const base: VoteState = confirmed ?? { count: voteCount, voted };
  const [shown, toggleOptimistically] = useOptimistic(base, (current: VoteState) => ({
    voted: !current.voted,
    count: current.count + (current.voted ? -1 : 1),
  }));
  const [error, setError] = useState<string | null>(null);
  const [pending, startActionTransition] = useTransition();
  // One request at a time: a second click while one is in flight would race the toggle.
  const busy = useRef(false);

  function onClick() {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    startActionTransition(async () => {
      toggleOptimistically(null);
      try {
        const result = await toggleVoteAction(ideaId);
        if (result.ok) {
          // State set after an await is no longer part of the action, so wrap it again.
          startTransition(() => setConfirmed({ count: result.voteCount, voted: result.voted }));
        } else {
          setError(
            result.error === "rate_limited"
              ? "Slow down: too many votes. Try again in a minute."
              : "This idea is no longer available.",
          );
        }
      } catch {
        setError("Could not save your vote. Try again.");
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <div className="relative w-14 shrink-0 self-start">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={shown.voted}
        aria-busy={pending}
        aria-label={`Upvote, ${plural(shown.count, "vote")}`}
        className={cn(
          "flex w-full flex-col items-center gap-1 rounded-md border px-3 py-2 text-base font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          shown.voted
            ? "border-primary bg-primary text-primary-foreground active:bg-primary-active"
            : "border-border bg-canvas text-ink active:bg-surface-strong",
        )}
      >
        <ChevronUp aria-hidden className={cn("size-4", shown.voted && "fill-current")} />
        <span aria-hidden>{shown.count}</span>
      </button>
      {error ? (
        <p
          role="alert"
          className="absolute top-full left-0 z-10 mt-1 w-48 rounded-sm bg-status-declined px-2 py-1 text-[13px] font-medium text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
