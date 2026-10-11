import { Suspense } from "react";
import { connection } from "next/server";
import { BoardJoinForm } from "@/components/auth/board-join-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db";
import { previewBoardLink } from "@/lib/board-share-links";

async function BoardJoinContent({ token }: { token: Promise<string> }) {
  // Whether a link is still valid depends on the database, so render per request, never at build.
  await connection();
  const raw = await token;
  // Read-only: opening a link must never use it up, because chat apps pre-fetch links (G4).
  const preview = await previewBoardLink(getDb(), raw);
  if (!preview.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-[32px] leading-[1.2] text-ink">Link not valid</h1>
          </CardTitle>
          <CardDescription>
            This link is not valid. It may have been replaced. Ask the Team for a new one.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-[32px] leading-[1.2] text-ink">Open {preview.boardName}</h1>
        </CardTitle>
        <CardDescription>
          {preview.teamName} shared this Private board with you. Continue to read it and take part.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BoardJoinForm token={raw} />
      </CardContent>
    </Card>
  );
}

/** The "Continue" page for `/join/board/<token>` (US-2.4). */
export function BoardJoinPage({ token }: { token: Promise<string> }) {
  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center gap-4 p-12">
      <Suspense fallback={<p className="text-base text-body">Checking your link…</p>}>
        <BoardJoinContent token={token} />
      </Suspense>
    </main>
  );
}
