import { Skeleton } from "@/components/board/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-label="Loading ideas">
      <Skeleton className="h-10 w-80" />
      <div className="flex items-start gap-8">
        <Skeleton className="h-72 w-60 shrink-0" />
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    </div>
  );
}
