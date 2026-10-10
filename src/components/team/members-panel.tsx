import { leaveTeamAction, removeMemberAction } from "@/components/team/member-actions";
import { Button } from "@/components/ui/button";
import type { MemberRole } from "@/db/schema";

export type MemberRow = { id: string; displayName: string; role: MemberRole };

const ROLE_LABEL: Record<MemberRole, string> = { owner: "Owner", member: "Member" };

/**
 * The "Members" section (US-3.4, US-3.7). Everyone signed in sees who is on the Team. Only Owners
 * get "Remove", never for the last Owner and never on their own row; everyone gets "Leave Team",
 * except the last Owner, who is told to delete the Team instead.
 */
export function MembersPanel({
  members,
  currentMemberId,
  currentRole,
}: {
  members: MemberRow[];
  currentMemberId: string;
  currentRole: MemberRole;
}) {
  const ownerCount = members.filter((member) => member.role === "owner").length;
  const lastOwner = currentRole === "owner" && ownerCount === 1;

  return (
    <section aria-labelledby="members-title" className="flex flex-col gap-4">
      <h2 id="members-title" className="text-2xl text-ink">
        Members
      </h2>
      <ul aria-label="Members" className="flex flex-col divide-y divide-hairline">
        {members.map((member) => {
          const isYou = member.id === currentMemberId;
          const removable =
            currentRole === "owner" && !isYou && !(member.role === "owner" && ownerCount === 1);
          return (
            <li key={member.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex flex-col">
                <span className="text-base font-medium text-ink">
                  {member.displayName}
                  {isYou ? " (you)" : ""}
                </span>
                <span className="text-sm text-muted-foreground">{ROLE_LABEL[member.role]}</span>
              </div>
              {removable ? (
                <form action={removeMemberAction}>
                  <input type="hidden" name="memberId" value={member.id} />
                  <Button
                    type="submit"
                    variant="secondary"
                    aria-label={`Remove ${member.displayName}`}
                  >
                    Remove
                  </Button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
      {lastOwner ? (
        <p className="rounded-md bg-surface-soft px-4 py-3 text-base text-body">
          You are the last Owner, so you cannot leave. Delete the Team instead.
        </p>
      ) : (
        <form action={leaveTeamAction}>
          <Button type="submit" variant="secondary">
            Leave Team
          </Button>
        </form>
      )}
    </section>
  );
}
