"use client";

import { useActionState, useState } from "react";
import { createTeamAction, type CreateTeamState } from "@/components/team/create-team-action";
import { SecretLink } from "@/components/team/secret-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TEAM_LIMITS, type CreateTeamFields } from "@/lib/create-team-input";
import { DISPLAY_NAME_MAX } from "@/lib/redeem-input";
import { SLUG_LIMITS, slugify } from "@/lib/slugs";

function Field({
  id,
  label,
  error,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        autoComplete="off"
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The one-time "save your Owner link" state (US-3.1). Leaving or reloading the page loses the link. */
function SaveOwnerLink({ teamName, path }: { teamName: string; path: string }) {
  return (
    <section
      aria-labelledby="save-link-title"
      className="flex flex-col gap-4 rounded-lg bg-surface-dark p-8 text-on-dark"
    >
      <h1 id="save-link-title" className="text-[32px] leading-[1.2]">
        {teamName} is ready
      </h1>
      <p className="text-base" role="alert">
        Save this link now. It is shown only once. It signs you in as the Owner on any device, and
        anyone who has it can manage this Team.
      </p>
      <SecretLink path={path} testId="owner-link">
        {/* A plain link on purpose: a full page load drops this page's state, so the Owner
            link is gone for good and Back cannot bring it back (US-3.1). */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
          Go to dashboard
        </a>
      </SecretLink>
    </section>
  );
}

export function CreateTeamForm() {
  const [state, formAction, pending] = useActionState<CreateTeamState | null, FormData>(
    createTeamAction,
    null,
  );
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  // Every field is controlled: React clears uncontrolled fields after a form action, which
  // would wipe what the person typed whenever the server answers with an error.
  const [boardName, setBoardName] = useState("");
  const [displayName, setDisplayName] = useState("");

  if (state?.ok) return <SaveOwnerLink teamName={state.teamName} path={state.ownerLinkPath} />;

  const errors: Partial<Record<CreateTeamFields, string>> =
    state && !state.ok && state.error === "invalid" ? state.fieldErrors : {};
  const rateLimited = state && !state.ok && state.error === "rate_limited";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[40px] leading-[1.2] text-ink">Create a Team</h1>
        <p className="text-base text-body">
          A Team owns Boards where people share and vote on Ideas. You will get a secret Owner link
          to sign in again later.
        </p>
      </div>
      {rateLimited ? (
        <p role="alert" className="rounded-md bg-status-declined px-4 py-3 text-sm text-danger">
          You are creating Teams too fast. Slow down and try again in an hour.
        </p>
      ) : null}
      <Field
        id="team-name"
        name="teamName"
        label="Team name"
        value={teamName}
        maxLength={TEAM_LIMITS.name}
        error={errors.teamName}
        onChange={(event) => {
          setTeamName(event.target.value);
          if (!slugEdited) setTeamSlug(slugify(event.target.value));
        }}
      />
      <Field
        id="team-slug"
        name="teamSlug"
        label="Team slug"
        value={teamSlug}
        maxLength={SLUG_LIMITS.max}
        hint="Your Boards live at /team-slug/board-name. Lowercase letters, numbers and hyphens."
        error={errors.teamSlug}
        onChange={(event) => {
          setSlugEdited(true);
          setTeamSlug(event.target.value);
        }}
      />
      <Field
        id="board-name"
        name="boardName"
        label="First Board name"
        value={boardName}
        maxLength={TEAM_LIMITS.boardName}
        error={errors.boardName}
        onChange={(event) => setBoardName(event.target.value)}
      />
      <Field
        id="display-name"
        name="displayName"
        label="Your display name"
        value={displayName}
        maxLength={DISPLAY_NAME_MAX}
        hint="Shown to your teammates as the Owner."
        error={errors.displayName}
        onChange={(event) => setDisplayName(event.target.value)}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create Team"}
      </Button>
    </form>
  );
}
