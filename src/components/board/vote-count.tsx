import { ChevronUp } from "lucide-react";
import { plural } from "@/lib/format";

/** Read-only vote count in the vote-button shape; Phase 3 turns it into the voting button. */
export function VoteCount({ count }: { count: number }) {
  return (
    <div
      role="img"
      aria-label={plural(count, "vote")}
      className="flex w-14 shrink-0 flex-col items-center gap-1 self-start rounded-md border border-border bg-canvas px-3 py-2 text-base font-medium text-ink tabular-nums"
    >
      <ChevronUp aria-hidden className="size-4" />
      <span aria-hidden>{count}</span>
    </div>
  );
}
