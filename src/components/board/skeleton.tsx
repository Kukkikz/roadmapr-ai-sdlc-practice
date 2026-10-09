import { cn } from "@/lib/utils";

/** Loading placeholder block; sized by the caller. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-strong", className)} />
  );
}
