"use client";

import { useActionState } from "react";
import { redeemAction, type RedeemFormState } from "@/components/auth/redeem-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DISPLAY_NAME_MAX, type RedeemKind } from "@/lib/redeem-input";

const ERRORS = {
  invalid: "This link is not valid.",
  rate_limited: "Too many attempts. Slow down and try again in a few minutes.",
} as const;

/** The "Continue" button (and, for a Member invite, the display name). Nothing happens until it is pressed (G4). */
export function RedeemForm({
  kind,
  token,
  needsName,
}: {
  kind: RedeemKind;
  token: string;
  needsName: boolean;
}) {
  const [state, formAction, pending] = useActionState<RedeemFormState | null, FormData>(
    redeemAction.bind(null, kind),
    null,
  );
  const nameError = state?.error === "invalid_name" ? state.message : undefined;
  const formError = state && state.error !== "invalid_name" ? ERRORS[state.error] : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {formError ? (
        <p role="alert" className="rounded-md bg-status-declined px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      ) : null}
      {needsName ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="display-name">Display name</Label>
          <Input
            id="display-name"
            name="displayName"
            maxLength={DISPLAY_NAME_MAX}
            required
            autoComplete="off"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "display-name-error" : undefined}
          />
          {nameError ? (
            <p id="display-name-error" className="text-sm text-danger">
              {nameError}
            </p>
          ) : null}
        </div>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Continuing…" : "Continue"}
      </Button>
    </form>
  );
}
