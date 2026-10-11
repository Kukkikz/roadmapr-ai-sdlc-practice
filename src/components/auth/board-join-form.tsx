"use client";

import { useActionState } from "react";
import { joinBoardAction, type JoinBoardFormState } from "@/components/auth/board-join-action";
import { Button } from "@/components/ui/button";

const ERRORS = {
  invalid: "This link is not valid.",
  rate_limited: "Too many attempts. Slow down and try again in a few minutes.",
} as const;

/** The "Continue" button of a Board share link. Nothing happens until it is pressed (G4). */
export function BoardJoinForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<JoinBoardFormState | null, FormData>(
    joinBoardAction,
    null,
  );
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {state ? (
        <p role="alert" className="rounded-md bg-status-declined px-4 py-3 text-sm text-danger">
          {ERRORS[state.error]}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Continuing…" : "Continue"}
      </Button>
    </form>
  );
}
