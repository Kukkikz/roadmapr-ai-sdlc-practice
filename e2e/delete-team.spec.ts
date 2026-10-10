import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { createTeamKeepingOwnerLink, generateInvite, joinWithInvite } from "./team-helpers";

test("an Owner deletes the Team after typing its slug, and everything of it stops working (US-3.8)", async ({
  page,
  browser,
  baseURL,
}) => {
  const { slug, ownerLink } = await createTeamKeepingOwnerLink(page);
  const invite = await generateInvite(page);
  const bo = await joinWithInvite(browser, baseURL!, invite, "Bo");

  // The Team's public board exists before.
  await page.goto(`/${slug}/feedback`);
  await expect(page.getByRole("heading", { name: "Ideas", level: 1 })).toBeVisible();
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Danger zone" })).toBeVisible();
  await page.getByRole("button", { name: "Delete Team" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("all Boards, Ideas, Votes, Comments and Tags")).toBeVisible();
  await expect(dialog.getByText("every Owner link, Member invite link")).toBeVisible();

  // Disabled until the text matches exactly.
  const confirm = dialog.getByRole("button", { name: "Delete Team" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/Type .* to confirm/).fill(slug.toUpperCase());
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/Type .* to confirm/).fill(`${slug}x`);
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/Type .* to confirm/).fill(slug);
  await expect(confirm).toBeEnabled();
  await confirm.click();

  // Signed out and told it is gone.
  await expect(page).toHaveURL(/\/team-deleted$/);
  await expect(page.getByRole("heading", { name: "Team deleted" })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  // Visitors get the generic not-found page; links and sessions are dead.
  await page.goto(`/${slug}/feedback`);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.goto(ownerLink);
  await expect(page.getByRole("heading", { name: "Link not valid" })).toBeVisible();
  await page.goto(invite);
  await expect(page.getByRole("heading", { name: "Link not valid" })).toBeVisible();
  await bo.page.reload();
  await expect(bo.page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await bo.context.close();

  // The slug is free at once.
  await page.goto("/new");
  await page.getByLabel("Team name").fill("Second life");
  await page.getByLabel("Team slug").fill(slug);
  await page.getByLabel("First Board name").fill("Ideas");
  await page.getByLabel("Your display name").fill("Zed");
  await page.getByRole("button", { name: "Create Team" }).click();
  await expect(page.getByTestId("owner-link")).toBeVisible();
});

test("cancelling keeps the Team, and the dialog starts empty next time", async ({ page }) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  await page.getByRole("button", { name: "Delete Team" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Type .* to confirm/).fill(slug);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto(`/${slug}/feedback`);
  await expect(page.getByRole("heading", { name: "Ideas", level: 1 })).toBeVisible();

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Delete Team" }).click();
  await expect(page.getByRole("dialog").getByLabel(/Type .* to confirm/)).toHaveValue("");
});

test("Members do not get the Danger zone (US-3.6)", async ({ page, browser, baseURL }) => {
  await createTeamKeepingOwnerLink(page);
  const invite = await generateInvite(page);
  const bo = await joinWithInvite(browser, baseURL!, invite, "Bo");
  await expect(bo.page.getByRole("heading", { name: "Danger zone" })).toHaveCount(0);
  await expect(bo.page.getByRole("button", { name: "Delete Team" })).toHaveCount(0);
  await bo.context.close();
});
