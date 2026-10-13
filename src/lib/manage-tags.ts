import { z } from "zod";
import { createTag, deleteTag, getBoardById, getTag, listTags, updateTag } from "@/data";
import type { Db } from "@/data";
import { DEFAULT_TAG_COLOR, TAG_COLORS } from "./tag-colors";
import { TAG_LIMITS } from "./tag-limits";

export const NAME_TAKEN = "A Tag with this name already exists on this Board.";

const tagSchema = z.object({
  name: z
    .string({ error: "Enter a Tag name." })
    .trim()
    .min(1, "Enter a Tag name.")
    .max(TAG_LIMITS.name, `Tag name must be ${TAG_LIMITS.name} characters or fewer.`),
  color: z.enum(TAG_COLORS, { error: "Choose one of the listed colours." }),
});

export type TagFields = "name" | "color";
export type TagFieldErrors = Partial<Record<TagFields, string>>;

type Tag = NonNullable<Awaited<ReturnType<typeof getTag>>>;

export type ManageTagResult =
  | { ok: true; tag: Tag }
  | { ok: false; error: "invalid"; fieldErrors: TagFieldErrors }
  | { ok: false; error: "not-found" };

function parseTag(input: { name?: unknown; color?: unknown }, defaultColor?: string) {
  const parsed = tagSchema.safeParse({ name: input.name, color: input.color ?? defaultColor });
  if (parsed.success) return { data: parsed.data };
  const fieldErrors: TagFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as TagFields;
    fieldErrors[field] ??= issue.message;
  }
  return { fieldErrors };
}

/*
 * Members manage a Board's Tags (US-5.2). The caller has already checked with `requireRole` that
 * the requester is a Member of `teamId`, which comes from the Session. `boardId` and `tagId`
 * come from the request, so every function scopes them to the Team: a Board or Tag of another
 * Team answers like a missing one.
 */
async function boardOfTeam(db: Db, teamId: string, boardId: unknown) {
  if (typeof boardId !== "string") return null;
  const board = await getBoardById(db, boardId);
  return board && board.teamId === teamId ? board : null;
}

async function tagOfTeam(db: Db, teamId: string, tagId: unknown) {
  if (typeof tagId !== "string") return null;
  const tag = await getTag(db, tagId);
  if (!tag) return null;
  return (await boardOfTeam(db, teamId, tag.boardId)) ? tag : null;
}

/** True if another Tag on the Board already has this name, ignoring case. */
async function nameTaken(db: Db, boardId: string, name: string, exceptTagId?: string) {
  const existing = await listTags(db, boardId);
  const wanted = name.toLowerCase();
  return existing.some((tag) => tag.id !== exceptTagId && tag.name.toLowerCase() === wanted);
}

const taken = { ok: false, error: "invalid", fieldErrors: { name: NAME_TAKEN } } as const;

export async function createBoardTag(
  db: Db,
  teamId: string,
  boardId: unknown,
  input: { name?: unknown; color?: unknown },
): Promise<ManageTagResult> {
  const board = await boardOfTeam(db, teamId, boardId);
  if (!board) return { ok: false, error: "not-found" };
  const { data, fieldErrors } = parseTag(input, DEFAULT_TAG_COLOR);
  if (!data) return { ok: false, error: "invalid", fieldErrors };
  if (await nameTaken(db, board.id, data.name)) return taken;
  try {
    return { ok: true, tag: await createTag(db, { boardId: board.id, ...data }) };
  } catch (error) {
    // Someone took the name between the check and the insert (unique per Board).
    if (await nameTaken(db, board.id, data.name)) return taken;
    throw error;
  }
}

export async function updateBoardTag(
  db: Db,
  teamId: string,
  tagId: unknown,
  input: { name?: unknown; color?: unknown },
): Promise<ManageTagResult> {
  const tag = await tagOfTeam(db, teamId, tagId);
  if (!tag) return { ok: false, error: "not-found" };
  const { data, fieldErrors } = parseTag(input);
  if (!data) return { ok: false, error: "invalid", fieldErrors };
  if (await nameTaken(db, tag.boardId, data.name, tag.id)) return taken;
  try {
    const updated = await updateTag(db, tag.id, data);
    return updated ? { ok: true, tag: updated } : { ok: false, error: "not-found" };
  } catch (error) {
    if (await nameTaken(db, tag.boardId, data.name, tag.id)) return taken;
    throw error;
  }
}

/** Deleting a Tag takes it off every Idea (cascade); the Ideas stay. */
export async function deleteBoardTag(
  db: Db,
  teamId: string,
  tagId: unknown,
): Promise<"deleted" | "not_found"> {
  const tag = await tagOfTeam(db, teamId, tagId);
  if (!tag) return "not_found";
  await deleteTag(db, tag.id);
  return "deleted";
}
