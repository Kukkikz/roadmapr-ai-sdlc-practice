import { Suspense } from "react";
import { connection } from "next/server";
import { RedeemForm } from "@/components/auth/redeem-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db";
import { previewLink } from "@/lib/redeem";
import type { RedeemKind } from "@/lib/redeem-input";

async function RedeemContent({ kind, token }: { kind: RedeemKind; token: Promise<string> }) {
  // Whether a link is still valid depends on the clock, so render per request, never at build.
  await connection();
  const raw = await token;
  // Read-only: opening a link must never use it up, because chat apps pre-fetch links (G4).
  const preview = await previewLink(getDb(), kind, raw);
  if (!preview.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-[32px] leading-[1.2] text-ink">Link not valid</h1>
          </CardTitle>
          <CardDescription>
            This link is not valid. It may have expired or been replaced. Ask the Owner of the Team
            for a new one.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-[32px] leading-[1.2] text-ink">
            {kind === "owner" ? `Sign in to ${preview.teamName}` : `Join ${preview.teamName}`}
          </h1>
        </CardTitle>
        <CardDescription>
          {kind === "owner"
            ? "You are signing in as an Owner with your Owner link."
            : "Choose the display name your teammates and the board will see."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RedeemForm kind={kind} token={raw} needsName={preview.needsName} />
      </CardContent>
    </Card>
  );
}

/** Shared "Continue" page for `/login/<token>` and `/join/<token>`. */
export function RedeemPage({ kind, token }: { kind: RedeemKind; token: Promise<string> }) {
  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center gap-4 p-12">
      <Suspense fallback={<p className="text-base text-body">Checking your link…</p>}>
        <RedeemContent kind={kind} token={token} />
      </Suspense>
    </main>
  );
}
