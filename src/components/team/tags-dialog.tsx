"use client";

import { useActionState, useState, startTransition, type FormEvent } from "react";
import {
  createTagAction,
  deleteTagAction,
  updateTagAction,
  type TagState,
} from "@/components/team/tag-actions";
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
import { TAG_LIMITS } from "@/lib/tag-limits";
import { DEFAULT_TAG_COLOR, TAG_COLORS, TAG_COLOR_LABELS } from "@/lib/tag-colors";

export type BoardTag = { id: string; name: string; color: string };

const SELECT_CLASS =
  "h-11 rounded-sm border border-input bg-background px-4 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

function stateMessage(state: TagState | null) {
  if (!state || state.ok) return undefined;
  if (state.error === "invalid") return state.fieldErrors.name ?? state.fieldErrors.color;
  return state.error === "forbidden"
    ? "Only Team Members can manage Tags."
    : "This Tag or Board no longer exists.";
}

/**
 * Runs a Tag action from a form's submit event. Passing the action to `<form action>` would let
 * React reset the form afterwards, and a reset puts a controlled `<select>` back on its first
 * option while the state still holds the chosen one.
 */
function useTagForm(action: (previous: TagState | null, formData: FormData) => Promise<TagState>) {
  const [state, run, pending] = useActionState(action, null);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => run(formData));
  };
  return [state, onSubmit, pending] as const;
}

function ColorSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <select
      id={id}
      name="color"
      value={value}
      className={SELECT_CLASS}
      onChange={(event) => onChange(event.target.value)}
    >
      {TAG_COLORS.map((color) => (
        <option key={color} value={color}>
          {TAG_COLOR_LABELS[color]}
        </option>
      ))}
    </select>
  );
}

/** A Member's "Tags" button and dialog for one Board (US-5.2). The forms mount only while open. */
export function TagsDialog({
  board,
  tags,
}: {
  board: { id: string; name: string };
  tags: BoardTag[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" aria-label={`Tags for ${board.name}`}>
          Tags
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Tags for {board.name}</DialogTitle>
        <DialogDescription>
          Tags group this Board&apos;s Ideas. Deleting a Tag takes it off its Ideas; the Ideas stay.
        </DialogDescription>
        {tags.length > 0 ? (
          <ul aria-label="Tags" className="flex flex-col gap-3">
            {tags.map((tag) => (
              <TagRow key={tag.id} tag={tag} />
            ))}
          </ul>
        ) : (
          <p className="rounded-md bg-surface-soft px-4 py-3 text-base text-body">
            No Tags yet. Add the first one below.
          </p>
        )}
        <CreateTagForm boardId={board.id} />
        <div className="flex justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Done
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TagRow({ tag }: { tag: BoardTag }) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [state, onSave, pending] = useTagForm(updateTagAction);
  const [deleteState, onDelete, deleting] = useTagForm(deleteTagAction);
  const message = stateMessage(state) ?? stateMessage(deleteState);
  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={onSave} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="tagId" value={tag.id} />
          <Label htmlFor={`tag-name-${tag.id}`} className="sr-only">
            Name of Tag {tag.name}
          </Label>
          <Input
            id={`tag-name-${tag.id}`}
            name="name"
            value={name}
            maxLength={TAG_LIMITS.name}
            required
            autoComplete="off"
            className="w-44"
            aria-invalid={message ? true : undefined}
            onChange={(event) => setName(event.target.value)}
          />
          <Label htmlFor={`tag-color-${tag.id}`} className="sr-only">
            Colour of Tag {tag.name}
          </Label>
          <ColorSelect id={`tag-color-${tag.id}`} value={color} onChange={setColor} />
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </form>
        <form onSubmit={onDelete}>
          <input type="hidden" name="tagId" value={tag.id} />
          <Button
            type="submit"
            variant="secondary"
            disabled={deleting}
            aria-label={`Delete Tag ${tag.name}`}
          >
            Delete
          </Button>
        </form>
      </div>
      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
    </li>
  );
}

function CreateTagForm({ boardId }: { boardId: string }) {
  // Controlled: React clears uncontrolled fields after a form action, even a failed one.
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_TAG_COLOR);
  const [state, onSubmit, pending] = useTagForm(async (previous, formData) => {
    const next = await createTagAction(previous, formData);
    if (next.ok) {
      setName("");
      setColor(DEFAULT_TAG_COLOR);
    }
    return next;
  });
  const message = stateMessage(state);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="boardId" value={boardId} />
      <Label htmlFor={`new-tag-name-${boardId}`}>New Tag</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={`new-tag-name-${boardId}`}
          name="name"
          value={name}
          maxLength={TAG_LIMITS.name}
          required
          autoComplete="off"
          className="w-44"
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `new-tag-error-${boardId}` : undefined}
          onChange={(event) => setName(event.target.value)}
        />
        <Label htmlFor={`new-tag-color-${boardId}`} className="sr-only">
          Colour of the new Tag
        </Label>
        <ColorSelect id={`new-tag-color-${boardId}`} value={color} onChange={setColor} />
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add Tag"}
        </Button>
      </div>
      {message ? (
        <p id={`new-tag-error-${boardId}`} role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
    </form>
  );
}
