import { Skeleton } from "@/components/board/skeleton";

export default function Loading() {
  return (
    <div
      className="mx-auto flex max-w-[720px] flex-col gap-8"
      role="status"
      aria-label="Loading idea"
    >
      <Skeleton className="h-5 w-40" />
      <div className="flex gap-4">
        <Skeleton className="h-20 w-14 shrink-0" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-5 w-48" />
        </div>
      </div>
      <Skeleton className="h-24" />
      <Skeleton className="h-16" />
    </div>
  );
}
