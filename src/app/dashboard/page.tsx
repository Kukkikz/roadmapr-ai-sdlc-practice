import { Suspense } from "react";
import { notFound } from "next/navigation";
import { signOutAction } from "@/components/auth/sign-out-action";
import { InviteLinksPanel } from "@/components/team/invite-links-panel";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { listInviteLinks } from "@/lib/invite-links";
import { getSession } from "@/lib/session";

/** Fixed locale and zone so the server and the browser print the same text. */
const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

async function DashboardContent() {
  const session = await getSession();
  // Signed-out visitors get the same page as any unknown URL (G3).
  if (!session) notFound();
  // Only Owners manage links (US-3.6); the action refuses anyone else as well.
  const invites =
    session.member.role === "owner" ? await listInviteLinks(getDb(), session.team.id) : null;
  return (
    <>
      <h1 className="text-[40px] leading-[1.2] text-ink">{session.team.name}</h1>
      <p className="text-base text-body">
        Signed in as {session.member.displayName} ({session.member.role}).
      </p>
      {invites ? (
        <InviteLinksPanel
          links={invites.map((link) => ({
            id: link.id,
            createdLabel: formatDate(link.createdAt),
            expiresLabel: formatDate(link.expiresAt),
            status: link.status,
          }))}
        />
      ) : null}
      <form action={signOutAction}>
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </>
  );
}

// Placeholder until the Team dashboard (US-4.3) lands; it exists so sign-in has somewhere to go.
export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 p-12">
      <Suspense fallback={<p className="text-base text-body">Loading…</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
