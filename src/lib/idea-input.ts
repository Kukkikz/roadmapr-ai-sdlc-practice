import { z } from "zod";

/** Limits from SPEC US-2.1. */
export const IDEA_LIMITS = { title: 120, description: 2000, authorName: 40 } as const;

/** An optional text field: trimmed, and an empty or missing value becomes undefined. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => value || undefined)
    .optional();

export const submitIdeaSchema = z.object({
  boardId: z.string().min(1).max(100),
  title: z
    .string({ error: "Enter a title." })
    .trim()
    .min(1, "Enter a title.")
    .max(IDEA_LIMITS.title, `Title must be ${IDEA_LIMITS.title} characters or fewer.`),
  description: optionalText(IDEA_LIMITS.description, "Description"),
  authorName: optionalText(IDEA_LIMITS.authorName, "Display name"),
});

export type SubmitIdeaFields = "title" | "description" | "authorName";
