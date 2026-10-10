import { z } from "zod";
import { TEAM_LIMITS } from "./create-team-input";
import { slugSchema } from "./slugs";

/** Limits from SPEC US-4.1. */
export const BOARD_LIMITS = { name: TEAM_LIMITS.boardName, description: 300 } as const;

export const createBoardSchema = z.object({
  name: z
    .string({ error: "Enter a board name." })
    .trim()
    .min(1, "Enter a board name.")
    .max(BOARD_LIMITS.name, `Board name must be ${BOARD_LIMITS.name} characters or fewer.`),
  slug: slugSchema,
  description: z
    .string()
    .trim()
    .max(
      BOARD_LIMITS.description,
      `Description must be ${BOARD_LIMITS.description} characters or fewer.`,
    )
    .transform((value) => value || undefined)
    .optional(),
});

export type CreateBoardFields = keyof z.infer<typeof createBoardSchema>;
