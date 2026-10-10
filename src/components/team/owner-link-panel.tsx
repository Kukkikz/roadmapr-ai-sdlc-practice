"use client";

import { useActionState } from "react";
import {
  replaceOwnerLinkAction,
  type ReplaceOwnerLinkState,
} from "@/components/team/owner-link-actions";
import { SecretLink } from "@/components/team/secret-link";
import { Button } from "@/components/ui/button";

/** The Owner's "Owner link" section on the dashboard (US-3.2). */
export function OwnerLinkPanel() {
  const [state, replace, pending] = useActionState<ReplaceOwnerLinkState | null>(
    replaceOwnerLinkAction,
    null,
  );

  return (
    <section aria-labelledby="owner-link-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="owner-link-title" className="text-2xl text-ink">
          Owner link
        </h2>
        <p className="text-base text-body">
          Your Owner link signs you in as an Owner on any device. If you lost it or shared it by
          mistake, replace it: the old link stops working at once. You stay signed in here.
        </p>
      </div>

      {state && !state.ok ? (
        <p role="alert" className="rounded-md bg-status-declined px-4 py-3 text-sm text-danger">
          Only an Owner can replace an Owner link.
        </p>
      ) : null}

      {state?.ok ? (
        <div className="flex flex-col gap-4 rounded-lg bg-surface-dark p-8 text-on-dark">
          <p className="text-base" role="alert">
            Save this link now. It is shown only once. It signs you in as an Owner on any device,
            and anyone who has it can manage this Team.
          </p>
          <SecretLink path={state.ownerLinkPath} testId="new-owner-link" />
        </div>
      ) : null}

      <form action={replace}>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Replacing…" : "Replace Owner link"}
        </Button>
      </form>
    </section>
  );
}
