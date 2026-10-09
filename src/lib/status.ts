import type { IdeaStatus } from "@/db/schema";

export const STATUS_LABELS: Record<IdeaStatus, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In progress",
  shipped: "Shipped",
  declined: "Declined",
};

/** The `Badge` variant for a status (the badge uses a hyphen where the database uses an underscore). */
export function statusVariant(status: IdeaStatus) {
  return status === "in_progress" ? "in-progress" : status;
}
