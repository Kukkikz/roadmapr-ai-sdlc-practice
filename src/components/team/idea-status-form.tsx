"use client";

import { useActionState } from "react";
import { changeStatusAction } from "@/components/team/idea-status-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { STATUS_LABELS } from "@/lib/status";
import { IDEA_STATUSES, type IdeaStatus } from "@/db/schema";

/**
 * A Member's status control on the Idea page (US-5.1): any status to any other. The server
 * checks the role, the Team and the value again, so this form is only a convenience.
 */
export function IdeaStatusForm({
  ideaId,
  status,
  title,
}: {
  ideaId: string;
  status: IdeaStatus;
  /** Names the control for assistive tech where several share a page (the queue). */
  title?: string;
}) {
  const [state, action, pending] = useActionState(changeStatusAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="ideaId" value={ideaId} />
      <Label htmlFor={`status-${ideaId}`}>Status</Label>
      <select
        id={`status-${ideaId}`}
        name="status"
        aria-label={title ? `Status of ${title}` : undefined}
        defaultValue={status}
        className="h-11 rounded-sm border border-input bg-background px-4 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {IDEA_STATUSES.map((value) => (
          <option key={value} value={value}>
            {STATUS_LABELS[value]}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Change status"}
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.error === "forbidden"
            ? "Only Team Members can change the status."
            : state.error === "not-found"
              ? "This Idea no longer exists."
              : "Pick one of the listed statuses."}
        </p>
      ) : null}
    </form>
  );
}
