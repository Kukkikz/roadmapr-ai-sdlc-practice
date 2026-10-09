import { expect, type Locator, type Page } from "@playwright/test";
import { randomIp, test } from "./fixtures";

const BOARD = "/acme/sandbox";

/** The upvote button on a board card, found by the Idea title. */
const cardVote = (page: Page, title: string): Locator =>
  page
    .getByRole("list", { name: "Ideas" })
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByRole("button", { name: /^Upvote/ });

const isServerAction = (headers: Record<string, string>) => "next-action" in headers;

/** Clicks a vote button and waits until the server has answered, so a reload cannot cut the request off. */
async function clickVote(page: Page, vote: Locator) {
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && isServerAction(response.request().headers()),
  );
  await vote.click();
  await answered;
  // The button ignores clicks until it has applied the answer.
  await expect(vote).toHaveAttribute("aria-busy", "false");
}

test("upvotes, shows it as pressed, keeps it after a reload and takes it back", async ({
  page,
}) => {
  await page.goto(BOARD);
  const vote = cardVote(page, "Vote A");
  await expect(vote).toHaveAccessibleName("Upvote, 0 votes");
  await expect(vote).toHaveAttribute("aria-pressed", "false");

  await clickVote(page, vote);
  await expect(vote).toHaveAccessibleName("Upvote, 1 vote");
  await expect(vote).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(cardVote(page, "Vote A")).toHaveAccessibleName("Upvote, 1 vote");
  await expect(cardVote(page, "Vote A")).toHaveAttribute("aria-pressed", "true");

  await clickVote(page, cardVote(page, "Vote A"));
  await expect(cardVote(page, "Vote A")).toHaveAccessibleName("Upvote, 0 votes");
  await expect(cardVote(page, "Vote A")).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(cardVote(page, "Vote A")).toHaveAccessibleName("Upvote, 0 votes");
});

test("updates the count before the server answers, then keeps the server count", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/acme/sandbox", async (route) => {
    if (route.request().method() === "POST" && isServerAction(route.request().headers())) {
      await gate;
    }
    await route.continue();
  });

  await page.goto(BOARD);
  const vote = cardVote(page, "Vote B");
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && isServerAction(response.request().headers()),
  );
  await vote.click();
  // The request is held back, so this change can only be the optimistic one.
  await expect(vote).toHaveAccessibleName("Upvote, 1 vote");
  await expect(vote).toHaveAttribute("aria-pressed", "true");

  release();
  await answered;
  await expect(vote).toHaveAttribute("aria-busy", "false");
  await expect(vote).toHaveAccessibleName("Upvote, 1 vote");
  await expect(vote).toHaveAttribute("aria-pressed", "true");

  await clickVote(page, vote);
  await expect(vote).toHaveAccessibleName("Upvote, 0 votes");
});

test("rolls the optimistic vote back and says so when the request fails", async ({ page }) => {
  await page.goto(BOARD);
  await page.route("**/acme/sandbox", async (route) => {
    if (route.request().method() === "POST" && isServerAction(route.request().headers())) {
      await route.abort();
    } else {
      await route.continue();
    }
  });
  const vote = cardVote(page, "Vote C");
  await vote.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Could not save your vote" }),
  ).toBeVisible();
  await expect(vote).toHaveAccessibleName("Upvote, 0 votes");
  await expect(vote).toHaveAttribute("aria-pressed", "false");
});

test("voting on the Idea page and on the board agree", async ({ page }) => {
  await page.goto(BOARD);
  await page.getByRole("link", { name: "Vote D" }).click();
  // Next keeps the board page mounted but hidden, so find this page by its h1.
  const detail = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { level: 1 }) })
    .getByRole("button", { name: /^Upvote/ });
  await expect(detail).toHaveAccessibleName("Upvote, 0 votes");
  await clickVote(page, detail);
  await expect(detail).toHaveAccessibleName("Upvote, 1 vote");

  await page.goto(BOARD);
  await expect(cardVote(page, "Vote D")).toHaveAccessibleName("Upvote, 1 vote");
  await expect(cardVote(page, "Vote D")).toHaveAttribute("aria-pressed", "true");
  await clickVote(page, cardVote(page, "Vote D"));
  await expect(cardVote(page, "Vote D")).toHaveAccessibleName("Upvote, 0 votes");
});

test("shows the right vote state after going back from an Idea (client navigation)", async ({
  page,
}) => {
  await page.goto(BOARD);
  await page.getByRole("link", { name: "Vote F" }).click();
  const detail = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { level: 1 }) })
    .getByRole("button", { name: /^Upvote/ });
  await clickVote(page, detail);
  await expect(detail).toHaveAccessibleName("Upvote, 1 vote");

  await page.goBack();
  await expect(cardVote(page, "Vote F")).toHaveAccessibleName("Upvote, 1 vote");
  await expect(cardVote(page, "Vote F")).toHaveAttribute("aria-pressed", "true");

  await clickVote(page, cardVote(page, "Vote F"));
  await expect(cardVote(page, "Vote F")).toHaveAccessibleName("Upvote, 0 votes");
});

test("counts one vote per Visitor: a second browser adds its own", async ({ page, browser }) => {
  await page.goto(BOARD);
  await clickVote(page, cardVote(page, "Vote E"));
  await expect(cardVote(page, "Vote E")).toHaveAccessibleName("Upvote, 1 vote");

  const other = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": randomIp() },
  });
  const second = await other.newPage();
  await second.goto(BOARD);
  // Sees the first Visitor vote, but it is not pressed for them.
  await expect(cardVote(second, "Vote E")).toHaveAccessibleName("Upvote, 1 vote");
  await expect(cardVote(second, "Vote E")).toHaveAttribute("aria-pressed", "false");
  await clickVote(second, cardVote(second, "Vote E"));
  await expect(cardVote(second, "Vote E")).toHaveAccessibleName("Upvote, 2 votes");

  // Clean up so reruns start from zero.
  await clickVote(second, cardVote(second, "Vote E"));
  await expect(cardVote(second, "Vote E")).toHaveAccessibleName("Upvote, 1 vote");
  await other.close();
  await clickVote(page, cardVote(page, "Vote E"));
  await expect(cardVote(page, "Vote E")).toHaveAccessibleName("Upvote, 0 votes");
});

test("allows voting on an Idea that has shipped", async ({ page }) => {
  await page.goto(BOARD);
  const vote = cardVote(page, "Vote on shipped");
  await clickVote(page, vote);
  await expect(vote).toHaveAccessibleName("Upvote, 1 vote");
  await page.reload();
  await expect(cardVote(page, "Vote on shipped")).toHaveAttribute("aria-pressed", "true");
  await clickVote(page, cardVote(page, "Vote on shipped"));
  await expect(cardVote(page, "Vote on shipped")).toHaveAccessibleName("Upvote, 0 votes");
});
