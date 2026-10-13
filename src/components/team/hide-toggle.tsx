"use client";

import { useActionState } from "react";
import { setCommentHiddenAction, setIdeaHiddenAction } from "@/components/team/moderation-actions";
import { Button } from "@/components/ui/button";

/**
 * A Member's hide / unhide button for an Idea or a Comment (US-5.3). The server checks the
 * role and the Team again, so this form is only a convenience.
 */
export function HideToggle({
  kind,
  id,
  hidden,
}: {
  kind: "idea" | "comment";
  id: string;
  hidden: boolean;
}) {
  const [state, action, pending] = useActionState(
    kind === "idea" ? setIdeaHiddenAction : setCommentHiddenAction,
    null,
  );
  const label = `${hidden ? "Unhide" : "Hide"} ${kind}`;
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name={kind === "idea" ? "ideaId" : "commentId"} value={id} />
      <input type="hidden" name="hidden" value={hidden ? "false" : "true"} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.error === "forbidden"
            ? "Only Team Members can hide or unhide."
            : state.error === "invalid"
              ? "Could not tell whether to hide or unhide."
              : `This ${kind} no longer exists.`}
        </p>
      ) : null}
    </form>
  );
}
