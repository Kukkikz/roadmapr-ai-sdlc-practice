"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { AuthorizationError, requireSessionRole } from "@/lib/authz";
import { createBoardForTeam } from "@/lib/create-board";
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
    });
    if (!result.ok) return result;
    revalidatePath("/dashboard");
    return { ok: true, boardName: result.boardName };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
}
