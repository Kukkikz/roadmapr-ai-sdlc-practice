import { Skeleton } from "@/components/board/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-label="Loading roadmap">
      <Skeleton className="h-9 w-48" />
      <div className="grid grid-cols-3 items-start gap-6">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
