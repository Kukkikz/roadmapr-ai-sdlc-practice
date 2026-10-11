"use client";

import { useActionState, useState } from "react";
import { createBoardAction, type CreateBoardState } from "@/components/team/board-actions";
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
import { Textarea } from "@/components/ui/textarea";
import { BOARD_LIMITS, type CreateBoardFields } from "@/lib/create-board-input";
import { SLUG_LIMITS, slugify } from "@/lib/slugs";

/** The Owner's "Create board" button and dialog (US-4.1). The form mounts only while open. */
export function CreateBoardDialog({ teamSlug }: { teamSlug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">Create board</Button>
      </DialogTrigger>
      <DialogContent>
        <CreateBoardForm teamSlug={teamSlug} onDone={() => setOpen(false)} />
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

function CreateBoardForm({ teamSlug, onDone }: { teamSlug: string; onDone: () => void }) {
  // Every field is controlled: React clears uncontrolled fields after a form action, which would
  // wipe what was typed whenever the server answers with an error.
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");

  const [state, action, pending] = useActionState(
    async (previous: CreateBoardState | null, formData: FormData) => {
      const next = await createBoardAction(previous, formData);
      if (next.ok) onDone();
      return next;
    },
    null,
  );
  const errors: Partial<Record<CreateBoardFields, string>> =
    state && !state.ok && state.error === "invalid" ? state.fieldErrors : {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogTitle>Create a Board</DialogTitle>
      <DialogDescription>
        A Board is where people share and vote on Ideas. It is public: anyone with the link can read
        it and take part.
      </DialogDescription>

      {state && !state.ok && state.error === "forbidden" ? (
        <p role="alert" className="rounded-md bg-status-declined px-4 py-3 text-sm text-danger">
          Only an Owner can create Boards.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="board-name">Board name</Label>
        <Input
          id="board-name"
          name="name"
          value={name}
          maxLength={BOARD_LIMITS.name}
          required
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "board-name-error" : undefined}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugEdited) setSlug(slugify(event.target.value));
          }}
        />
        <FieldError id="board-name-error" message={errors.name} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="board-slug">Board slug</Label>
        <Input
          id="board-slug"
          name="slug"
          value={slug}
          maxLength={SLUG_LIMITS.max}
          required
          autoComplete="off"
          aria-invalid={errors.slug ? true : undefined}
          aria-describedby={errors.slug ? "board-slug-error" : "board-slug-hint"}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value);
          }}
        />
        {errors.slug ? (
          <FieldError id="board-slug-error" message={errors.slug} />
        ) : (
          <p id="board-slug-hint" className="text-sm text-muted-foreground">
            Lives at /{teamSlug}/{slug || "board-slug"}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="board-description">Description (optional)</Label>
        <Textarea
          id="board-description"
          name="description"
          value={description}
          maxLength={BOARD_LIMITS.description}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? "board-description-error" : undefined}
          onChange={(event) => setDescription(event.target.value)}
        />
        <FieldError id="board-description-error" message={errors.description} />
      </div>

      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create board"}
        </Button>
      </div>
    </form>
  );
}
