import { z } from "zod";

/** The link kinds that sign someone in. Board share links are redeemed by Visitors instead. */
export type RedeemKind = "owner" | "member_invite";

export const DISPLAY_NAME_MAX = 40;

export const displayNameSchema = z
  .string({ error: "Enter a display name." })
  .trim()
  .min(1, "Enter a display name.")
  .max(DISPLAY_NAME_MAX, `Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`);
