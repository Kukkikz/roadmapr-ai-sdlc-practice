import { Suspense } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/board/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { getVisibleBoard } from "@/lib/board-view";

async function BoardNav({ params }: { params: LayoutProps<"/[teamSlug]/[boardSlug]">["params"] }) {
  const { teamSlug, boardSlug } = await params;
  const found = await getVisibleBoard(teamSlug, boardSlug);
  // A missing or Private board renders the not-found page from the page itself.
  if (!found) return null;
  const basePath = `/${found.team.slug}/${found.board.slug}`;
  return (
    <>
      <Link
        href={basePath}
        className="rounded-sm text-base font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {found.team.name} · {found.board.name}
      </Link>
      <nav aria-label="Board" className="ml-auto flex items-center gap-2">
        <Link href={basePath} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Ideas
        </Link>
        <Link href={`${basePath}/roadmap`} className={buttonVariants({ variant: "secondary" })}>
          Roadmap
        </Link>
      </nav>
    </>
  );
}

export default function BoardLayout({ children, params }: LayoutProps<"/[teamSlug]/[boardSlug]">) {
  return (
    <>
      <header className="flex h-16 items-center gap-4 border-b border-border bg-canvas px-12">
        <Suspense fallback={<Skeleton className="h-6 w-56" />}>
          <BoardNav params={params} />
        </Suspense>
      </header>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-12 py-8">{children}</main>
    </>
  );
}
