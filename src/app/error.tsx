"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-start justify-center gap-4 p-12">
      <h1 className="text-[32px] leading-[1.2] text-ink">Something went wrong</h1>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
