"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { submitIdeaAction, suggestSimilarIdeasAction } from "@/app/[teamSlug]/[boardSlug]/actions";
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
import { IDEA_LIMITS } from "@/lib/idea-input";
import { plural } from "@/lib/format";
import type { SimilarIdea } from "@/lib/similar-ideas";
import type { SubmitIdeaResult } from "@/lib/submit-idea";

type BoardRef = { boardId: string; teamSlug: string; boardSlug: string };

/** Wait this long after the last keystroke before looking for similar Ideas (US-2.1). */
const HINT_DEBOUNCE_MS = 300;
const HINT_MIN_LENGTH = 3;

/** Similar Ideas for the title being typed. Quiet on any failure: the hint is a nicety. */
function useSimilarIdeas(boardId: string, title: string): SimilarIdea[] {
  const [hints, setHints] = useState<SimilarIdea[]>([]);
  const trimmed = title.trim();
  const active = trimmed.length >= HINT_MIN_LENGTH;

  useEffect(() => {
    if (!active) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const result = await suggestSimilarIdeasAction(boardId, trimmed).catch(() => null);
      if (!stale) setHints(result?.ok ? result.ideas : []);
    }, HINT_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [active, boardId, trimmed]);

  return active ? hints : [];
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-[13px] font-medium text-danger">
      {message}
    </p>
  ) : null;
}

function SubmitIdeaForm({
  boardId,
  teamSlug,
  boardSlug,
  onDone,
}: BoardRef & { onDone: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [authorName, setAuthorName] = useState("");
  const hints = useSimilarIdeas(boardId, title);

  const [result, formAction, pending] = useActionState(
    async (previous: SubmitIdeaResult | null, formData: FormData) => {
      const next = await submitIdeaAction(previous, formData);
      if (next.ok) {
        onDone();
        // A discarded (honeypot) submission has no Idea to open.
        if (next.ideaId) router.push(`/${teamSlug}/${boardSlug}/ideas/${next.ideaId}`);
      }
      return next;
    },
    null,
  );

  const fieldErrors = result && !result.ok && result.error === "invalid" ? result.fieldErrors : {};
  const formError =
    result && !result.ok
      ? result.error === "rate_limited"
        ? "You are submitting too fast. Slow down and try again in a few minutes."
        : result.error === "not_found"
          ? "This board is no longer available."
          : null
      : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="boardId" value={boardId} />
      {/* Honeypot: invisible and unreachable for people, tempting for bots (US-2.1). */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {formError ? (
        <p role="alert" className="rounded-md bg-status-declined px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="idea-title">Title</Label>
        <Input
          id="idea-title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={IDEA_LIMITS.title}
          required
          autoComplete="off"
          aria-invalid={fieldErrors.title ? true : undefined}
          aria-describedby={fieldErrors.title ? "idea-title-error" : undefined}
        />
        <FieldError id="idea-title-error" message={fieldErrors.title} />
        {hints.length > 0 ? (
          <div aria-live="polite" className="rounded-md bg-muted p-3 text-sm">
            <p className="mb-1 text-[13px] font-medium text-muted-foreground">
              Similar ideas already on this board
            </p>
            <ul className="flex flex-col gap-1">
              {hints.map((hint) => (
                <li key={hint.id}>
                  <a
                    href={`/${teamSlug}/${boardSlug}/ideas/${hint.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-sm text-link underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {hint.title}
                  </a>{" "}
                  <span className="text-muted-foreground">({plural(hint.voteCount, "vote")})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="idea-description">Description (optional)</Label>
        <Textarea
          id="idea-description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={IDEA_LIMITS.description}
          aria-invalid={fieldErrors.description ? true : undefined}
          aria-describedby={fieldErrors.description ? "idea-description-error" : undefined}
        />
        <FieldError id="idea-description-error" message={fieldErrors.description} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="idea-author">Display name (optional)</Label>
        <Input
          id="idea-author"
          name="authorName"
          value={authorName}
          onChange={(event) => setAuthorName(event.target.value)}
          maxLength={IDEA_LIMITS.authorName}
          autoComplete="off"
          aria-invalid={fieldErrors.authorName ? true : undefined}
          aria-describedby={fieldErrors.authorName ? "idea-author-error" : undefined}
        />
        <FieldError id="idea-author-error" message={fieldErrors.authorName} />
      </div>

      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit idea"}
        </Button>
      </div>
    </form>
  );
}

/** The "Submit idea" button and its dialog. The form mounts only while open, so it starts empty each time. */
export function SubmitIdeaDialog(props: BoardRef) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Submit idea</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Submit an idea</DialogTitle>
        <DialogDescription>No sign-in needed.</DialogDescription>
        <SubmitIdeaForm {...props} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
