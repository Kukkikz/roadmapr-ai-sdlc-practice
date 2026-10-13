"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { AuthorizationError, requireSessionRole } from "@/lib/authz";
import { formText } from "@/lib/form-data";
import {
  createBoardTag,
  deleteBoardTag,
  updateBoardTag,
  type ManageTagResult,
  type TagFieldErrors,
} from "@/lib/manage-tags";

export type TagState =
  | { ok: true }
  | { ok: false; error: "invalid"; fieldErrors: TagFieldErrors }
  | { ok: false; error: "forbidden" | "not-found" };

/**
 * Members manage Tags (US-5.2). Each action starts with `requireSessionRole` (US-3.6); the Team
 * comes from the Session, and `boardId` / `tagId` are only honoured for that Team's own Boards.
 */
async function run(
  work: (teamId: string) => Promise<ManageTagResult | "deleted" | "not_found">,
): Promise<TagState> {
  try {
    const { team } = await requireSessionRole("member");
    const result = await work(team.id);
    if (result === "not_found") return { ok: false, error: "not-found" };
    if (typeof result === "object" && !result.ok) {
      return result.error === "invalid" ? result : { ok: false, error: "not-found" };
    }
    revalidatePath("/dashboard");
    revalidatePath(`/${team.slug}`, "layout");
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
}

export async function createTagAction(
  _previous: TagState | null,
  formData: FormData,
): Promise<TagState> {
  return run((teamId) =>
    createBoardTag(getDb(), teamId, formText(formData, "boardId"), {
      name: formText(formData, "name"),
      color: formText(formData, "color"),
    }),
  );
}

export async function updateTagAction(
  _previous: TagState | null,
  formData: FormData,
): Promise<TagState> {
  return run((teamId) =>
    updateBoardTag(getDb(), teamId, formText(formData, "tagId"), {
      name: formText(formData, "name"),
      color: formText(formData, "color"),
    }),
  );
}

export async function deleteTagAction(
  _previous: TagState | null,
  formData: FormData,
): Promise<TagState> {
  return run((teamId) => deleteBoardTag(getDb(), teamId, formText(formData, "tagId")));
}
