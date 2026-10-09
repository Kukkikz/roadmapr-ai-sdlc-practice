import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// One page for every "no such thing": unknown URLs, deleted Teams and Boards, hidden Ideas and
// Private boards the requester cannot see (G3). It must not reveal which of those it was.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-start justify-center gap-4 p-12">
      <h1 className="text-[32px] leading-[1.2] text-ink">Page not found</h1>
      <p className="text-base text-body">
        This page does not exist, or you do not have access to it.
      </p>
      <Link href="/" className={buttonVariants()}>
        Go to the home page
      </Link>
    </main>
  );
}
