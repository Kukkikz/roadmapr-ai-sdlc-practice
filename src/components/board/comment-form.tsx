"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { submitCommentAction } from "@/app/[teamSlug]/[boardSlug]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COMMENT_LIMITS } from "@/lib/idea-input";
import type { SubmitCommentResult } from "@/lib/submit-comment";

/** Add a Comment as a Visitor (US-2.3). The new Comment appears in the list above on success. */
export function CommentForm({ ideaId }: { ideaId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");

  const [result, formAction, pending] = useActionState(
    async (previous: SubmitCommentResult | null, formData: FormData) => {
      const next = await submitCommentAction(previous, formData);
      if (next.ok) {
        // Keep the display name for the next Comment; clear only the text.
        setBody("");
        router.refresh();
      }
      return next;
    },
    null,
  );

  const fieldErrors = result && !result.ok && result.error === "invalid" ? result.fieldErrors : {};
  const formError =
    result && !result.ok
      ? result.error === "rate_limited"
        ? "You are commenting too fast. Slow down and try again in a few minutes."
        : result.error === "not_found"
          ? "This idea is no longer available."
          : null
      : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="ideaId" value={ideaId} />
      {/* Honeypot: invisible and unreachable for people, tempting for bots (US-2.3). */}
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
        <Label htmlFor="comment-body">Add a comment</Label>
        <Textarea
          id="comment-body"
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={COMMENT_LIMITS.body}
          aria-invalid={fieldErrors.body ? true : undefined}
          aria-describedby={fieldErrors.body ? "comment-body-error" : undefined}
        />
        {fieldErrors.body ? (
          <p id="comment-body-error" role="alert" className="text-[13px] font-medium text-danger">
            {fieldErrors.body}
          </p>
        ) : null}
      </div>

      <div className="flex items-end gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="comment-author">Display name (optional)</Label>
          <Input
            id="comment-author"
            name="authorName"
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            maxLength={COMMENT_LIMITS.authorName}
            autoComplete="off"
            aria-invalid={fieldErrors.authorName ? true : undefined}
            aria-describedby={fieldErrors.authorName ? "comment-author-error" : undefined}
          />
          {fieldErrors.authorName ? (
            <p
              id="comment-author-error"
              role="alert"
              className="text-[13px] font-medium text-danger"
            >
              {fieldErrors.authorName}
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post comment"}
        </Button>
      </div>
    </form>
  );
}
