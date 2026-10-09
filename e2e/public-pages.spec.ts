import { expect, test } from "@playwright/test";

// Data comes from src/db/seed.ts plus the hidden Idea added by scripts/e2e-setup.mts.
const BOARD = "/acme/product";

test.describe("board page", () => {
  test("lists visible Ideas with status, votes and comment counts, most voted first", async ({
    page,
  }) => {
    await page.goto(BOARD);
    await expect(page.getByRole("heading", { level: 1, name: "Product feedback" })).toBeVisible();
    const cards = page.getByRole("list", { name: "Ideas" }).getByRole("listitem");
    await expect(cards).toHaveCount(4);
    await expect(cards.first()).toContainText("Dark mode");
    await expect(cards.first()).toContainText("Planned");
    await expect(cards.first().getByRole("img", { name: "3 votes" })).toBeVisible();
    await expect(cards.first()).toContainText("2 comments");
    await expect(page.getByText("Secret hidden idea")).toHaveCount(0);
  });

  test("sorts, filters by status and tag, and searches", async ({ page }) => {
    await page.goto(BOARD);

    await page.getByRole("link", { name: "Newest" }).click();
    await expect(page).toHaveURL(/sort=newest/);
    const cards = page.getByRole("list", { name: "Ideas" }).getByRole("listitem");
    await expect(cards.first()).toContainText("Slack notifications");

    await page
      .getByRole("navigation", { name: "Status" })
      .getByRole("link", { name: "Planned" })
      .click();
    await expect(page).toHaveURL(/status=planned/);
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Dark mode");

    await page
      .getByRole("navigation", { name: "Status" })
      .getByRole("link", { name: "All" })
      .click();
    await expect(page).not.toHaveURL(/status=/);
    await page.getByRole("navigation", { name: "Tags" }).getByRole("link", { name: "api" }).click();
    await expect(page).toHaveURL(/tag=/);
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Public API");

    // Filters combine: the "api" Tag is on a different Idea than the Planned status.
    await page
      .getByRole("navigation", { name: "Status" })
      .getByRole("link", { name: "Planned" })
      .click();
    await expect(page).toHaveURL(/status=planned/);
    await expect(page).toHaveURL(/tag=/);
    await expect(page.getByRole("heading", { name: "No ideas match your search" })).toBeVisible();

    await page.goto(BOARD);
    await page.getByLabel("Search ideas").fill("spreadsheet");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/q=spreadsheet/);
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("CSV export");
  });

  test("shows a no-results state with a way to clear filters", async ({ page }) => {
    await page.goto(`${BOARD}?q=zzzznomatch`);
    await expect(page.getByRole("heading", { name: "No ideas match your search" })).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page.getByRole("list", { name: "Ideas" })).toBeVisible();
  });
});

test("an empty Board shows the empty state", async ({ page }) => {
  await page.goto("/acme/empty");
  await expect(page.getByRole("heading", { level: 1, name: "Empty board" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No ideas yet" })).toBeVisible();
});

test.describe("idea page", () => {
  test("shows the Idea, its Tags, Visitor comments and a labelled team reply", async ({ page }) => {
    await page.goto(BOARD);
    await page.getByRole("link", { name: "Dark mode" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Dark mode" })).toBeVisible();
    await expect(page.getByText("A dark theme for night owls.")).toBeVisible();
    // Next keeps the previous page mounted but hidden, so scope to this page's article.
    const idea = page.getByRole("article");
    await expect(idea.getByText("Planned", { exact: true })).toBeVisible();
    await expect(idea.getByText("ui", { exact: true })).toBeVisible();

    const comments = page.getByRole("region", { name: "Comments" }).getByRole("listitem");
    await expect(comments).toHaveCount(2);
    await expect(comments.nth(0)).toContainText("Would love this.");
    await expect(comments.nth(0)).not.toContainText("Team");
    await expect(comments.nth(1)).toContainText("On our list for next quarter.");
    await expect(comments.nth(1)).toContainText("Team");
    await expect(comments.nth(1)).toContainText("Ada Owner");
  });

  test("a hidden Idea is not found for Visitors", async ({ page }) => {
    await page.goto(`${BOARD}/ideas/hidden-idea-e2e`);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByText("Secret hidden idea")).toHaveCount(0);
  });
});

test.describe("roadmap", () => {
  test("shows planned, in progress and shipped columns without open Ideas", async ({ page }) => {
    await page.goto(`${BOARD}/roadmap`);
    await expect(page.getByRole("heading", { level: 1, name: "Roadmap" })).toBeVisible();
    const planned = page.getByRole("region", { name: "Planned" });
    await expect(planned).toContainText("Dark mode");
    await expect(page.getByRole("region", { name: "In progress" })).toContainText(
      "No ideas here yet.",
    );
    await expect(page.getByRole("region", { name: "Shipped" })).toContainText("No ideas here yet.");
    await expect(page.getByText("CSV export")).toHaveCount(0);
    await planned.getByRole("link", { name: "Dark mode" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Dark mode" })).toBeVisible();
  });
});

test.describe("not found", () => {
  test("a Private board looks exactly like a Board that does not exist", async ({ page }) => {
    await page.goto("/acme/beta");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    const privateBody = await page.getByRole("main").innerText();

    await page.goto("/acme/no-such-board");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    expect(await page.getByRole("main").innerText()).toBe(privateBody);

    await page.goto("/acme/beta/roadmap");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("an unknown Team is not found", async ({ page }) => {
    await page.goto("/no-such-team/product");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("an Idea id from another Board does not resolve under this Board", async ({ page }) => {
    await page.goto("/acme/product/ideas/not-a-real-id");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});
