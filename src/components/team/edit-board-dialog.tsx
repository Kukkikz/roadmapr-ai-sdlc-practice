"use client";

import { useActionState, useState } from "react";
import { editBoardAction, type EditBoardState } from "@/components/team/board-actions";
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
import { ShareLinkSection } from "@/components/team/share-link-section";
import { VisibilityField } from "@/components/team/visibility-field";
import { Textarea } from "@/components/ui/textarea";
import type { BoardVisibility } from "@/db/schema";
import { BOARD_LIMITS, type CreateBoardFields } from "@/lib/create-board-input";
import { SLUG_LIMITS } from "@/lib/slugs";

export type EditableBoard = {
  id: string;
  name: string;
  slug: string;
  description: string;
  isPublic: boolean;
  hasShareLink: boolean;
};

/** An Owner's "Edit" button and dialog for one Board (US-4.1). The form mounts only while open. */
export function EditBoardDialog({ board, teamSlug }: { board: EditableBoard; teamSlug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" aria-label={`Edit ${board.name}`}>
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <EditBoardForm board={board} teamSlug={teamSlug} onDone={() => setOpen(false)} />
        {board.isPublic ? null : (
          <ShareLinkSection boardId={board.id} hasLink={board.hasShareLink} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-danger">
      {message}
    </p>
  ) : null;
}

function EditBoardForm({
  board,
  teamSlug,
  onDone,
}: {
  board: EditableBoard;
  teamSlug: string;
  onDone: () => void;
}) {
  // Controlled, as in the create form: React clears uncontrolled fields after a form action.
  const [name, setName] = useState(board.name);
  const [slug, setSlug] = useState(board.slug);
  const [description, setDescription] = useState(board.description);
  const [visibility, setVisibility] = useState<BoardVisibility>(
    board.isPublic ? "public" : "private",
  );

  const [state, action, pending] = useActionState(
    async (previous: EditBoardState | null, formData: FormData) => {
      const next = await editBoardAction(previous, formData);
      if (next.ok) onDone();
      return next;
    },
    null,
  );
  const errors: Partial<Record<CreateBoardFields, string>> =
    state && !state.ok && state.error === "invalid" ? state.fieldErrors : {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="boardId" value={board.id} />
      <DialogTitle>Edit Board</DialogTitle>
      <DialogDescription>
        Changing the slug moves the Board to a new address; the old address stops working. Changing
        the visibility deletes nothing.
      </DialogDescription>

      {state && !state.ok && state.error !== "invalid" ? (
        <p role="alert" className="rounded-md bg-status-declined px-4 py-3 text-sm text-danger">
          {state.error === "forbidden"
            ? "Only an Owner can edit Boards."
            : "This Board no longer exists."}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`edit-name-${board.id}`}>Board name</Label>
        <Input
          id={`edit-name-${board.id}`}
          name="name"
          value={name}
          maxLength={BOARD_LIMITS.name}
          required
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `edit-name-error-${board.id}` : undefined}
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError id={`edit-name-error-${board.id}`} message={errors.name} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`edit-slug-${board.id}`}>Board slug</Label>
        <Input
          id={`edit-slug-${board.id}`}
          name="slug"
          value={slug}
          maxLength={SLUG_LIMITS.max}
          required
          autoComplete="off"
          aria-invalid={errors.slug ? true : undefined}
          aria-describedby={
            errors.slug ? `edit-slug-error-${board.id}` : `edit-slug-hint-${board.id}`
          }
          onChange={(event) => setSlug(event.target.value)}
        />
        {errors.slug ? (
          <FieldError id={`edit-slug-error-${board.id}`} message={errors.slug} />
        ) : (
          <p id={`edit-slug-hint-${board.id}`} className="text-sm text-muted-foreground">
            Lives at /{teamSlug}/{slug || "board-slug"}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`edit-description-${board.id}`}>Description (optional)</Label>
        <Textarea
          id={`edit-description-${board.id}`}
          name="description"
          value={description}
          maxLength={BOARD_LIMITS.description}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? `edit-description-error-${board.id}` : undefined}
          onChange={(event) => setDescription(event.target.value)}
        />
        <FieldError id={`edit-description-error-${board.id}`} message={errors.description} />
      </div>

      <VisibilityField
        idPrefix={`edit-visibility-${board.id}`}
        value={visibility}
        onChange={setVisibility}
      />

      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
