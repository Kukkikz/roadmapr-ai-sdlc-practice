import { expect, type Browser, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { createTeamKeepingOwnerLink, generateInvite, joinWithInvite } from "./team-helpers";

/** A Visitor (a fresh browser) posts an Idea on the Team's board; returns the Idea page URL. */
async function visitorPostsIdea(browser: Browser, baseURL: string, slug: string, title: string) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto(`/${slug}/feedback`);
  await page.getByRole("button", { name: "Submit idea" }).click();
  await page.getByRole("dialog").getByLabel("Title").fill(title);
  await page.getByRole("dialog").getByRole("button", { name: "Submit idea" }).click();
  await expect(page).toHaveURL(/\/ideas\//);
  const url = new URL(page.url()).pathname;
  await context.close();
  return url;
}

async function comment(page: Page, body: string) {
  await page.getByLabel("Add a comment").fill(body);
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: body })).toBeVisible();
}

const commentItem = (page: Page, body: string) =>
  page.getByRole("listitem").filter({ hasText: body });

test("a Member's Comment is labelled Team with their display name, set by the server (US-5.4)", async ({
  page,
  browser,
  baseURL,
}) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  const ideaUrl = await visitorPostsIdea(browser, baseURL!, slug, "Dark mode please");

  await page.goto(ideaUrl);
  // Signed in: no display name field, and it says whose name will be used.
  await expect(page.getByLabel("Display name (optional)")).toHaveCount(0);
  await expect(page.getByText("this comment is posted as")).toContainText("Olga and labelled Team");

  await comment(page, "We are on it");
  const reply = commentItem(page, "We are on it");
  await expect(reply.getByText("Team", { exact: true })).toBeVisible();
  await expect(reply).toContainText("Olga");

  // A Visitor's Comment on the same Idea carries no Team label.
  const visitor = await browser.newContext({ baseURL: baseURL! });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(ideaUrl);
  await visitorPage.getByLabel("Add a comment").fill("Yes please");
  await visitorPage.getByLabel("Display name (optional)").fill("Olga");
  await visitorPage.getByRole("button", { name: "Post comment" }).click();
  const theirs = commentItem(visitorPage, "Yes please");
  await expect(theirs).toBeVisible();
  // Even with the Member's name typed, a Visitor is never shown as the Team.
  await expect(theirs.getByText("Team", { exact: true })).toHaveCount(0);
  await expect(
    commentItem(visitorPage, "We are on it").getByText("Team", { exact: true }),
  ).toBeVisible();
  await visitor.close();
});

test("a Member of another Team gets no Team label on this Team's Board (US-5.4)", async ({
  page,
  browser,
  baseURL,
}) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  const ideaUrl = await visitorPostsIdea(browser, baseURL!, slug, "Export to CSV");

  const stranger = await browser.newContext({ baseURL: baseURL! });
  const strangerPage = await stranger.newPage();
  await createTeamKeepingOwnerLink(strangerPage, "Mallory");
  await strangerPage.goto(ideaUrl);
  // Signed in as a Member elsewhere: named, but not as this Team.
  await expect(strangerPage.getByText("this comment is posted as")).toContainText("Mallory");
  await expect(strangerPage.getByText("labelled Team")).toHaveCount(0);
  await comment(strangerPage, "Looks like us");
  const item = commentItem(strangerPage, "Looks like us");
  await expect(item).toContainText("Mallory");
  await expect(item.getByText("Team", { exact: true })).toHaveCount(0);
  await stranger.close();
});

test("an Idea posted by a Member is labelled Team, with no name field (US-5.4)", async ({
  page,
}) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  await page.goto(`/${slug}/feedback`);
  await page.getByRole("button", { name: "Submit idea" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Display name (optional)")).toHaveCount(0);
  await expect(dialog.getByText("this idea is posted as")).toContainText("Olga and labelled Team");
  await dialog.getByLabel("Title").fill("From the team");
  await dialog.getByRole("button", { name: "Submit idea" }).click();
  await expect(page).toHaveURL(/\/ideas\//);
  const byline = page.getByRole("article").getByText(/Olga ·/);
  await expect(byline).toBeVisible();
  await expect(page.getByRole("article").getByText("Team", { exact: true })).toBeVisible();
});

test("a removed Member's past Comments keep their name and Team label (US-3.4)", async ({
  page,
  browser,
  baseURL,
}) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  const invite = await generateInvite(page);
  const ideaUrl = await visitorPostsIdea(browser, baseURL!, slug, "Mobile app");
  const bo = await joinWithInvite(browser, baseURL!, invite, "Bo");
  await bo.page.goto(ideaUrl);
  await comment(bo.page, "Bo was here");

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Remove Bo" }).click();
  await expect(page.getByRole("list", { name: "Members" }).getByRole("listitem")).toHaveCount(1);

  await page.goto(ideaUrl);
  const kept = commentItem(page, "Bo was here");
  await expect(kept).toContainText("Bo");
  await expect(kept.getByText("Team", { exact: true })).toBeVisible();
  await bo.context.close();
});
