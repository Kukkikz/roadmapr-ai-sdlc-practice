import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";

const BOARD = "/acme/sandbox";

// The Sandbox board keeps Comments from earlier runs, so every body carries a per-run tag.
const run = () => Math.random().toString(36).slice(2, 8);

async function openIdea(page: Page, title: string) {
  await page.goto(BOARD);
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

const comments = (page: Page) =>
  page.getByRole("region", { name: "Comments" }).getByRole("listitem");

async function postComment(page: Page, body: string, name?: string) {
  await page.getByLabel("Add a comment").fill(body);
  if (name) await page.getByLabel("Display name (optional)").fill(name);
  await page.getByRole("button", { name: "Post comment" }).click();
}

test("a Visitor comments without signing in and sees it straight away", async ({ page }) => {
  const tag = run();
  await openIdea(page, "Comment A");
  await postComment(page, `Nice one ${tag}`, "Sam");
  const mine = comments(page).filter({ hasText: `Nice one ${tag}` });
  await expect(mine).toHaveCount(1);
  await expect(mine).toContainText("Sam");
  await expect(mine).not.toContainText("Team");
  // The box is emptied for the next Comment; the display name stays.
  await expect(page.getByLabel("Add a comment")).toHaveValue("");
  await expect(page.getByLabel("Display name (optional)")).toHaveValue("Sam");

  await page.reload();
  await expect(comments(page).filter({ hasText: `Nice one ${tag}` })).toHaveCount(1);
});

test("shows 'Anonymous' when no display name is given", async ({ page }) => {
  const tag = run();
  await openIdea(page, "Comment B");
  await postComment(page, `Unsigned ${tag}`);
  await expect(comments(page).filter({ hasText: `Unsigned ${tag}` })).toContainText("Anonymous");
});

test("an empty comment is rejected with a message and keeps the display name", async ({ page }) => {
  await openIdea(page, "Comment C");
  const before = await comments(page).count();
  await postComment(page, "   ", "Kit");
  await expect(page.getByText("Enter a comment.")).toBeVisible();
  await expect(page.getByLabel("Display name (optional)")).toHaveValue("Kit");
  await expect(comments(page)).toHaveCount(before);
});

test("a filled honeypot is silently discarded", async ({ page }) => {
  const tag = run();
  await openIdea(page, "Comment D");
  await page.getByLabel("Add a comment").fill(`Buy cheap ${tag}`);
  await page.locator('input[name="website"]').evaluate((el: HTMLInputElement) => {
    el.value = "http://spam.example";
  });
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText(/too fast|Enter a comment/)).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(`Buy cheap ${tag}`)).toHaveCount(0);
});

test("the 11th comment in 10 minutes shows a slow-down error and is not saved", async ({
  page,
}) => {
  test.setTimeout(90_000); // eleven round trips in dev mode
  const tag = run();
  // Bracketed markers, so "[tag-1]" is never a substring of "[tag-10]".
  const marker = (n: number) => `[${tag}-${n}]`;
  await openIdea(page, "Comment E");
  for (let i = 1; i <= 10; i++) {
    await postComment(page, `Flood ${marker(i)}`);
    await expect(comments(page).filter({ hasText: marker(i) })).toHaveCount(1);
  }
  await postComment(page, `Flood ${marker(11)}`);
  await expect(page.getByRole("alert").filter({ hasText: "Slow down" })).toBeVisible();
  // What was typed is kept so the Visitor can try again later.
  await expect(page.getByLabel("Add a comment")).toHaveValue(`Flood ${marker(11)}`);
  await page.reload();
  await expect(comments(page).filter({ hasText: marker(10) })).toHaveCount(1);
  await expect(page.getByText(marker(11))).toHaveCount(0);
});

test("allows commenting on an Idea that has shipped", async ({ page }) => {
  const tag = run();
  await openIdea(page, "Comment on shipped");
  await postComment(page, `Congrats ${tag}`);
  await expect(comments(page).filter({ hasText: `Congrats ${tag}` })).toHaveCount(1);
});

test("the comment count on the board follows new Comments", async ({ page }) => {
  const tag = run();
  await openIdea(page, "Comment A");
  await postComment(page, `Counting ${tag}`);
  await expect(comments(page).filter({ hasText: `Counting ${tag}` })).toHaveCount(1);
  await page.goto(BOARD);
  const card = page
    .getByRole("list", { name: "Ideas" })
    .getByRole("listitem")
    .filter({ hasText: "Comment A" });
  await expect(card).toContainText(/[1-9]\d* comments?/);
});
