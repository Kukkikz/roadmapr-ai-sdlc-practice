"use client";

import { useActionState } from "react";
import {
  generateInviteAction,
  revokeInviteAction,
  type GenerateInviteState,
} from "@/components/team/invite-actions";
import { SecretLink } from "@/components/team/secret-link";
import { Button } from "@/components/ui/button";
import type { InviteStatus } from "@/lib/invite-links";

/** A row for the list. Dates arrive as text formatted on the server, so server and browser agree. */
export type InviteRow = {
  id: string;
  createdLabel: string;
  expiresLabel: string;
  status: InviteStatus;
};

const STATUS_LABEL: Record<InviteStatus, string> = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
};

/** The Owner's "Invite links" section on the dashboard (US-3.3). */
export function InviteLinksPanel({ links }: { links: InviteRow[] }) {
  const [state, generate, pending] = useActionState<GenerateInviteState | null>(
    generateInviteAction,
    null,
  );

  return (
    <section aria-labelledby="invite-links-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="invite-links-title" className="text-2xl text-ink">
          Invite links
        </h2>
        <p className="text-base text-body">
          Anyone with an invite link can join this Team as a Member until it expires after 7 days or
          you revoke it.
        </p>
      </div>

      {state && !state.ok ? (
        <p role="alert" className="rounded-md bg-status-declined px-4 py-3 text-sm text-danger">
          Only an Owner can make invite links.
        </p>
      ) : null}

      {state?.ok ? (
        <div className="flex flex-col gap-4 rounded-lg bg-surface-dark p-8 text-on-dark">
          <p className="text-base">
            Copy this link now. It is shown only once. It expires in 7 days.
          </p>
          <SecretLink path={state.invitePath} testId="invite-link" />
        </div>
      ) : null}

      <form action={generate}>
        <Button type="submit" disabled={pending}>
          {pending ? "Generating…" : "Generate invite link"}
        </Button>
      </form>

      {links.length > 0 ? (
        <ul aria-label="Invite links" className="flex flex-col divide-y divide-hairline">
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex flex-col">
                <span className="text-base font-medium text-ink">{STATUS_LABEL[link.status]}</span>
                <span className="text-sm text-muted-foreground">
                  Created {link.createdLabel} · Expires {link.expiresLabel}
                </span>
              </div>
              {link.status === "active" ? (
                <form action={revokeInviteAction}>
                  <input type="hidden" name="linkId" value={link.id} />
                  <Button type="submit" variant="secondary">
                    Revoke
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md bg-surface-soft px-4 py-3 text-base text-body">
          No invite links yet.
        </p>
      )}
    </section>
  );
}
