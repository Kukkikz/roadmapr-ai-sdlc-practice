"use client";

import { useActionState, useState } from "react";
import { deleteBoardAction, type DeleteBoardState } from "@/components/team/board-actions";
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
 * An Owner's "Delete" button and type-to-confirm dialog for one Board (US-4.3; DESIGN.md
 * `confirm-dialog`). It says exactly what will be lost and keeps the button disabled until the
 * typed text equals the Board's name. That is a courtesy only: the server checks it again.
 */
export function DeleteBoardDialog({ board }: { board: { id: string; name: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="danger-secondary" aria-label={`Delete ${board.name}`}>
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DeleteBoardForm board={board} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Mounted only while the dialog is open, so it starts empty every time. */
function DeleteBoardForm({
  board,
  onDone,
}: {
  board: { id: string; name: string };
  onDone: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState(
    async (previous: DeleteBoardState | null, formData: FormData) => {
      const next = await deleteBoardAction(previous, formData);
      if (next.ok) onDone();
      return next;
    },
    null,
  );
  const inputId = `delete-board-${board.id}`;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="boardId" value={board.id} />
      <DialogTitle>Delete {board.name}?</DialogTitle>
      <DialogDescription asChild>
        <div className="flex flex-col gap-2 text-sm text-body">
          <p>This permanently deletes the Board and all of this, with no undo:</p>
          <ul className="list-disc pl-6">
            <li>all its Ideas, Votes and Comments</li>
            <li>all its Tags</li>
            <li>its Board share link</li>
          </ul>
          <p>
            Visitors who open its address will see &ldquo;not found&rdquo;. The slug is free for
            another Board of your Team.
          </p>
        </div>
      </DialogDescription>

      {state && !state.ok ? (
        <p role="alert" className="rounded-md bg-status-declined px-4 py-3 text-sm text-danger">
          {state.error === "forbidden"
            ? "Only an Owner can delete Boards."
            : state.error === "not-found"
              ? "This Board no longer exists."
              : "That does not match the Board name. Nothing was deleted."}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>
          Type <span className="font-mono text-[13px]">{board.name}</span> to confirm
        </Label>
        <Input
          id={inputId}
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
        <Button type="submit" variant="danger" disabled={typed.trim() !== board.name || pending}>
          {pending ? "Deleting…" : "Delete Board"}
        </Button>
      </div>
    </form>
  );
}
