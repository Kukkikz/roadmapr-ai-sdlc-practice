import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Team deleted · Roadmapr",
  robots: { index: false, follow: false },
};

// Where the Owner lands after deleting a Team (US-3.8). It names nothing about the Team.
export default function TeamDeletedPage() {
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center gap-4 p-12">
      <h1 className="text-[32px] leading-[1.2] text-ink">Team deleted</h1>
      <p className="text-base text-body">
        Your Team and everything in it are gone. Its links and sessions no longer work, and its slug
        is free for anyone to use.
      </p>
      <div className="flex gap-2">
        <Link href="/new" className={buttonVariants()}>
          Create a Team
        </Link>
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
          Go to the home page
        </Link>
      </div>
    </main>
  );
}
