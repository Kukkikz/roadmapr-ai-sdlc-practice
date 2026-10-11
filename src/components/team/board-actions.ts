"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { AuthorizationError, requireSessionRole } from "@/lib/authz";
import { createBoardForTeam } from "@/lib/create-board";
import { rotateBoardShareLink } from "@/lib/board-share-links";
import { editBoardForTeam } from "@/lib/edit-board";
import type { CreateBoardFields } from "@/lib/create-board-input";
import { formText } from "@/lib/form-data";

export type CreateBoardState =
  | { ok: true; boardName: string }
  | { ok: false; error: "invalid"; fieldErrors: Partial<Record<CreateBoardFields, string>> }
  | { ok: false; error: "forbidden" };

/**
 * An Owner creates a Board in their own Team (US-4.1). The first line is `requireSessionRole`
 * (US-3.6); the Team comes from the Session, never from the request, so no `teamId` field is read.
 */
export async function createBoardAction(
  _previous: CreateBoardState | null,
  formData: FormData,
): Promise<CreateBoardState> {
  try {
    const { team } = await requireSessionRole("owner");
    const result = await createBoardForTeam(getDb(), team, {
      name: formText(formData, "name"),
      slug: formText(formData, "slug"),
      description: formText(formData, "description"),
      visibility: formText(formData, "visibility"),
    });
    if (!result.ok) return result;
    revalidatePath("/dashboard");
    return { ok: true, boardName: result.boardName };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
}

export type EditBoardState =
  | { ok: true; boardName: string }
  | { ok: false; error: "invalid"; fieldErrors: Partial<Record<CreateBoardFields, string>> }
  | { ok: false; error: "forbidden" | "not-found" };

/**
 * An Owner edits a Board of their own Team (US-4.1). `boardId` is a form field, so it is only
 * ever used together with the Session's Team: another Team's Board answers "not-found".
 */
export async function editBoardAction(
  _previous: EditBoardState | null,
  formData: FormData,
): Promise<EditBoardState> {
  try {
    const { team } = await requireSessionRole("owner");
    const result = await editBoardForTeam(getDb(), team, formText(formData, "boardId") ?? "", {
      name: formText(formData, "name"),
      slug: formText(formData, "slug"),
      description: formText(formData, "description"),
      visibility: formText(formData, "visibility"),
    });
    if (!result.ok) return result;
    revalidatePath("/dashboard");
    return { ok: true, boardName: result.boardName };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
}

export type RotateShareLinkState =
  | {
      ok: true;
      /** `/join/board/<token>`. Returned once, in this response only; the server keeps its hash. */
      sharePath: string;
    }
  | { ok: false; error: "forbidden" | "not-found" };

/**
 * An Owner makes or replaces the share link of one of their own Team's Boards (US-4.2).
 * `boardId` is only honoured together with the Session's Team.
 */
export async function rotateShareLinkAction(boardId: string): Promise<RotateShareLinkState> {
  try {
    const { team } = await requireSessionRole("owner");
    const link = await rotateBoardShareLink(
      getDb(),
      team.id,
      typeof boardId === "string" ? boardId : "",
    );
    if (!link) return { ok: false, error: "not-found" };
    revalidatePath("/dashboard");
    return { ok: true, sharePath: `/join/board/${link.token}` };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
}
