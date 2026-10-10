import { z } from "zod";
import { displayNameSchema } from "./redeem-input";
import { slugSchema } from "./slugs";

/** Limits from SPEC US-3.1. */
export const TEAM_LIMITS = { name: 60, boardName: 60 } as const;

const requiredText = (max: number, empty: string, label: string) =>
  z
    .string({ error: empty })
    .trim()
    .min(1, empty)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const createTeamSchema = z.object({
  teamName: requiredText(TEAM_LIMITS.name, "Enter a team name.", "Team name"),
  teamSlug: slugSchema,
  boardName: requiredText(TEAM_LIMITS.boardName, "Enter a board name.", "Board name"),
  displayName: displayNameSchema,
});

export type CreateTeamFields = keyof z.infer<typeof createTeamSchema>;
