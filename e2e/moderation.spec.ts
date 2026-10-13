import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { createTeamKeepingOwnerLink, hydrated } from "./team-helpers";

test("a Member hides and unhides a Comment and an Idea; Visitors never see them (US-5.3)", async ({
  page,
  browser,
  baseURL,
}) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  await page.goto(`/${slug}/feedback`);
  await page.getByRole("button", { name: "Submit idea" }).click();
  await page.getByRole("dialog").getByLabel("Title").fill("Spammy idea");
  await page.getByRole("dialog").getByRole("button", { name: "Submit idea" }).click();
  await expect(page).toHaveURL(/\/ideas\//);
  const ideaUrl = new URL(page.url()).pathname;
  await hydrated(page);

  await page.getByLabel("Add a comment").fill("Buy my pills");
  await page.getByRole("button", { name: "Post comment" }).click();
  const comment = page.getByRole("region", { name: "Comments" }).getByRole("listitem");
  await expect(comment).toContainText("Buy my pills");

  const visitor = await browser.newContext({ baseURL: baseURL! });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(ideaUrl);
  await expect(visitorPage.getByText("Buy my pills")).toBeVisible();
  await expect(visitorPage.getByRole("button", { name: /^(Hide|Unhide) / })).toHaveCount(0);

  // Hiding the Comment: the Member still sees it, marked hidden; the Visitor does not.
  await page.getByRole("button", { name: "Hide comment" }).click();
  await expect(comment.locator('[data-slot="badge"]', { hasText: "Hidden" })).toBeVisible();
  await visitorPage.reload();
  await expect(visitorPage.getByRole("heading", { name: "Spammy idea" })).toBeVisible();
  await expect(visitorPage.getByText("Buy my pills")).toHaveCount(0);

  // Hiding the Idea: the Visitor gets not-found on the page and the Board list.
  await page.getByRole("button", { name: "Hide idea" }).click();
  await expect(page.getByRole("button", { name: "Unhide idea" })).toBeVisible();
  await visitorPage.reload();
  await expect(visitorPage.getByRole("heading", { name: "Spammy idea" })).toHaveCount(0);
  await visitorPage.goto(`/${slug}/feedback`);
  await expect(visitorPage.getByText("Spammy idea")).toHaveCount(0);

  // The Member still finds it on the Board, marked hidden.
  await page.goto(`/${slug}/feedback`);
  const card = page.getByRole("article").filter({ hasText: "Spammy idea" });
  await expect(card.locator('[data-slot="badge"]', { hasText: "Hidden" })).toBeVisible();

  // Unhiding brings both back for the Visitor.
  await card.getByRole("link", { name: "Spammy idea" }).click();
  await hydrated(page);
  await page.getByRole("button", { name: "Unhide idea" }).click();
  await expect(page.getByRole("button", { name: "Hide idea" })).toBeVisible();
  await page.getByRole("button", { name: "Unhide comment" }).click();
  await expect(page.getByRole("button", { name: "Hide comment" })).toBeVisible();
  await visitorPage.goto(ideaUrl);
  await expect(visitorPage.getByRole("heading", { name: "Spammy idea" })).toBeVisible();
  await expect(visitorPage.getByText("Buy my pills")).toBeVisible();
  await visitor.close();

  // A Member of another Team sees no hide control on this Idea.
  const stranger = await browser.newContext({ baseURL: baseURL! });
  const strangerPage = await stranger.newPage();
  await createTeamKeepingOwnerLink(strangerPage, "Mallory");
  await strangerPage.goto(ideaUrl);
  await expect(strangerPage.getByRole("heading", { name: "Spammy idea" })).toBeVisible();
  await expect(strangerPage.getByRole("button", { name: /^(Hide|Unhide) / })).toHaveCount(0);
  await stranger.close();
});
