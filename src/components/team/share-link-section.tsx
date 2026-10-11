"use client";

import { useState, useTransition } from "react";
import { rotateShareLinkAction, type RotateShareLinkState } from "@/components/team/board-actions";
import { SecretLink } from "@/components/team/secret-link";
import { Button } from "@/components/ui/button";

/**
 * A Private board's share link (US-4.2): whether one exists, and a button to make or replace it.
 * The new link is shown once; the server keeps only its hash. Replacing it ends the access the
 * old one gave. Lives outside the edit form, because forms cannot nest.
 */
export function ShareLinkSection({ boardId, hasLink }: { boardId: string; hasLink: boolean }) {
  const [state, setState] = useState<RotateShareLinkState | null>(null);
  const [pending, startTransition] = useTransition();
  const exists = hasLink || state?.ok === true;

  return (
    <section aria-label="Share link" className="flex flex-col gap-3 border-t border-hairline pt-4">
      <h3 className="text-base font-medium text-ink">Share link</h3>
      <p className="text-sm text-muted-foreground">
        {exists
          ? "A share link is active. Replacing it stops the old link and ends the access it gave."
          : "No share link yet. Only your Team's Members can open this Board until you make one."}
      </p>
      {state && !state.ok ? (
        <p role="alert" className="rounded-md bg-status-declined px-4 py-3 text-sm text-danger">
          {state.error === "forbidden"
            ? "Only an Owner can make share links."
            : "This Board no longer exists."}
        </p>
      ) : null}
      {state?.ok ? (
        <div className="flex flex-col gap-4 rounded-lg bg-surface-dark p-6 text-on-dark">
          <p className="text-base">Copy this link now. It is shown only once.</p>
          <SecretLink path={state.sharePath} testId="share-link" />
        </div>
      ) : null}
      <div>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => setState(await rotateShareLinkAction(boardId)))
          }
        >
          {pending ? "Working…" : exists ? "Rotate share link" : "Generate share link"}
        </Button>
      </div>
    </section>
  );
}
