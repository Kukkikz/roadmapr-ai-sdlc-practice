"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { signOut } from "@/lib/sign-out";

/** The "Sign out" button (US-3.5): deletes the Session on the server, clears the cookie, goes home. */
export async function signOutAction(): Promise<void> {
  await signOut(getDb());
  redirect("/");
}
