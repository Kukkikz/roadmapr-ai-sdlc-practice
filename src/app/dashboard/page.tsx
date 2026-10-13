import { Suspense } from "react";
import { notFound } from "next/navigation";
import { signOutAction } from "@/components/auth/sign-out-action";
import { BoardsPanel } from "@/components/team/boards-panel";
import { DeleteTeamDialog } from "@/components/team/delete-team-dialog";
import { InviteLinksPanel } from "@/components/team/invite-links-panel";
import { MembersPanel } from "@/components/team/members-panel";
import { OwnerLinkPanel } from "@/components/team/owner-link-panel";
import { Button } from "@/components/ui/button";
import { findActiveBoardShareLink, listActiveMembers, listBoardsForTeam, listTags } from "@/data";
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
  const db = getDb();
  const [invites, members, boards] = await Promise.all([
    session.member.role === "owner" ? listInviteLinks(db, session.team.id) : null,
    listActiveMembers(db, session.team.id),
    listBoardsForTeam(db, session.team.id),
  ]);
  // Whether each Private board has a working share link; only Owners manage them.
  const sharedBoardIds = new Set<string>();
  if (session.member.role === "owner") {
    const links = await Promise.all(
      boards
        .filter((b) => b.visibility === "private")
        .map((b) => findActiveBoardShareLink(db, b.id)),
    );
    for (const link of links) if (link?.boardId) sharedBoardIds.add(link.boardId);
  }
  const tagsByBoard = new Map(
    await Promise.all(boards.map(async (b) => [b.id, await listTags(db, b.id)] as const)),
  );
  return (
    <>
      <h1 className="text-[40px] leading-[1.2] text-ink">{session.team.name}</h1>
      <p className="text-base text-body">
        Signed in as {session.member.displayName} ({session.member.role}).
      </p>
      <BoardsPanel
        boards={boards.map((board) => ({
          id: board.id,
          name: board.name,
          slug: board.slug,
          description: board.description ?? "",
          isPublic: board.visibility === "public",
          hasShareLink: sharedBoardIds.has(board.id),
          tags: (tagsByBoard.get(board.id) ?? []).map(({ id, name, color }) => ({
            id,
            name,
            color,
          })),
        }))}
        teamSlug={session.team.slug}
        isOwner={session.member.role === "owner"}
      />
      <MembersPanel
        members={members.map((member) => ({
          id: member.id,
          displayName: member.displayName,
          role: member.role,
        }))}
        currentMemberId={session.member.id}
        currentRole={session.member.role}
      />
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
      {session.member.role === "owner" ? <OwnerLinkPanel /> : null}
      <form action={signOutAction}>
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
      {/* Last on the page, as the SPEC says (US-3.8). */}
      {session.member.role === "owner" ? (
        <DeleteTeamDialog teamName={session.team.name} teamSlug={session.team.slug} />
      ) : null}
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
