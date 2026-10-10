"use client";

import { useActionState, useState } from "react";
import { deleteTeamAction, type DeleteTeamState } from "@/components/team/delete-team-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The Owner's "Danger zone" with the type-to-confirm dialog (US-3.8; DESIGN.md `danger-zone` and
 * `confirm-dialog`). The dialog says exactly what will be lost and keeps "Delete Team" disabled
 * until the typed text equals the slug. That is a courtesy only: the server checks it again.
 */
export function DeleteTeamDialog({ teamName, teamSlug }: { teamName: string; teamSlug: string }) {
  const [open, setOpen] = useState(false);

  return (
    <section
      aria-labelledby="danger-zone-title"
      className="flex flex-col gap-4 rounded-md border border-danger p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="danger-zone-title" className="text-xl font-medium text-danger">
          Danger zone
        </h2>
        <p className="text-base text-body">
          Deleting the Team removes it and everything in it for good. There is no undo.
        </p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="danger-secondary" className="self-start">
            Delete Team
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DeleteTeamForm teamName={teamName} teamSlug={teamSlug} />
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Mounted only while the dialog is open, so it starts empty every time. */
function DeleteTeamForm({ teamName, teamSlug }: { teamName: string; teamSlug: string }) {
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState<DeleteTeamState | null, FormData>(
    deleteTeamAction,
    null,
  );
  const matches = typed === teamSlug;

  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogTitle>Delete {teamName}?</DialogTitle>
      <DialogDescription asChild>
        <div className="flex flex-col gap-2 text-sm text-body">
          <p>This permanently deletes the Team and all of this, with no undo:</p>
          <ul className="list-disc pl-6">
            <li>all Boards, Ideas, Votes, Comments and Tags</li>
            <li>all Members and their Sessions</li>
            <li>every Owner link, Member invite link and Board share link</li>
          </ul>
          <p>
            Visitors who open its pages will see &ldquo;not found&rdquo;. The slug is freed at once
            and anyone can claim it.
          </p>
        </div>
      </DialogDescription>

      {state && !state.ok ? (
        <p role="alert" className="rounded-md bg-status-declined px-4 py-3 text-sm text-danger">
          {state.error === "forbidden"
            ? "Only an Owner can delete the Team."
            : "That does not match the Team slug. Nothing was deleted."}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="delete-confirmation">
          Type <span className="font-mono text-[13px]">{teamSlug}</span> to confirm
        </Label>
        <Input
          id="delete-confirmation"
          name="confirmation"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" variant="danger" disabled={!matches || pending}>
          {pending ? "Deleting…" : "Delete Team"}
        </Button>
      </div>
    </form>
  );
}
