import { CreateBoardDialog } from "@/components/team/create-board-dialog";
import { Badge } from "@/components/ui/badge";

export type BoardRow = { id: string; name: string; slug: string; isPublic: boolean };

/**
 * The "Boards" section of the dashboard (US-4.1, US-4.3): every signed-in Member sees the Team's
 * Boards; Owners get "Create board", and a Team with no Boards says so and offers it. Links are
 * plain anchors on purpose (a full page load), so a shown-once link elsewhere on the dashboard
 * cannot come back from the client router's saved state when pressing Back (PLAN.md).
 */
export function BoardsPanel({
  boards,
  teamSlug,
  isOwner,
}: {
  boards: BoardRow[];
  teamSlug: string;
  isOwner: boolean;
}) {
  return (
    <section aria-labelledby="boards-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="boards-title" className="text-2xl text-ink">
          Boards
        </h2>
        {isOwner ? <CreateBoardDialog teamSlug={teamSlug} /> : null}
      </div>
      {boards.length > 0 ? (
        <ul aria-label="Boards" className="flex flex-col divide-y divide-hairline">
          {boards.map((board) => (
            <li key={board.id} className="flex items-center justify-between gap-4 py-3">
              <a
                href={`/${teamSlug}/${board.slug}`}
                className="rounded-sm text-base font-medium text-link underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {board.name}
              </a>
              <Badge>{board.isPublic ? "Public" : "Private"}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md bg-surface-soft px-4 py-3 text-base text-body">
          {isOwner
            ? "No Boards yet. Create the first one so people can start sharing ideas."
            : "No Boards yet. Ask an Owner to create one."}
        </p>
      )}
    </section>
  );
}
