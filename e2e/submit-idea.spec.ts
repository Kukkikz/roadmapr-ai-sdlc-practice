import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";

const BOARD = "/acme/sandbox";

async function openDialog(page: Page) {
  await page.goto(BOARD);
  await page.getByRole("button", { name: "Submit idea" }).click();
  await expect(page.getByRole("dialog", { name: "Submit an idea" })).toBeVisible();
}

async function submit(
  page: Page,
  title: string,
  extra: { description?: string; name?: string } = {},
) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  if (extra.description) await dialog.getByLabel("Description (optional)").fill(extra.description);
  if (extra.name) await dialog.getByLabel("Display name (optional)").fill(extra.name);
  await dialog.getByRole("button", { name: "Submit idea" }).click();
}

test.describe("submit an idea", () => {
  test("a Visitor submits an Idea without signing in and lands on it", async ({ page }) => {
    await openDialog(page);
    await submit(page, "Keyboard shortcuts", { description: "Vim keys please", name: "Sam" });
    await expect(page).toHaveURL(/\/acme\/sandbox\/ideas\//);
    const idea = page.getByRole("article");
    await expect(idea.getByRole("heading", { level: 1, name: "Keyboard shortcuts" })).toBeVisible();
    await expect(idea.getByText("Vim keys please")).toBeVisible();
    await expect(idea.getByText("Open", { exact: true })).toBeVisible();
    await expect(idea.getByText(/Sam/)).toBeVisible();

    // Visible immediately on the board.
    await page.goto(BOARD);
    await expect(page.getByRole("list", { name: "Ideas" })).toContainText("Keyboard shortcuts");
  });

  test("shows 'Anonymous' when no display name is given", async ({ page }) => {
    await openDialog(page);
    await submit(page, "Anonymous thoughts");
    await expect(page.getByRole("article").getByText(/^Anonymous ·/)).toBeVisible();
  });

  test("a blank title is rejected with a message and nothing is created", async ({ page }) => {
    await openDialog(page);
    await submit(page, "   ");
    await expect(page.getByRole("dialog").getByText("Enter a title.")).toBeVisible();
    await expect(page).toHaveURL(BOARD);
  });

  test("keeps what was typed when the server rejects the form", async ({ page }) => {
    await openDialog(page);
    await submit(page, "   ", { description: "Keep me", name: "Kit" });
    await expect(page.getByRole("dialog").getByText("Enter a title.")).toBeVisible();
    await expect(page.getByLabel("Description (optional)")).toHaveValue("Keep me");
    await expect(page.getByLabel("Display name (optional)")).toHaveValue("Kit");
  });

  test("Cancel closes the dialog and the next open starts empty", async ({ page }) => {
    await openDialog(page);
    await page.getByLabel("Title").fill("Never mind");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Submit idea" }).click();
    await expect(page.getByLabel("Title")).toHaveValue("");
  });

  test("a filled honeypot is silently discarded", async ({ page }) => {
    await openDialog(page);
    await page.getByLabel("Title").fill("Cheap watches");
    await page.locator('input[name="website"]').evaluate((el: HTMLInputElement) => {
      el.value = "http://spam.example";
    });
    await page.getByRole("dialog").getByRole("button", { name: "Submit idea" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(BOARD);
    await page.reload();
    await expect(page.getByText("Cheap watches")).toHaveCount(0);
  });

  test("the honeypot field is not reachable by keyboard or screen reader", async ({ page }) => {
    await openDialog(page);
    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toHaveAttribute("tabindex", "-1");
    await expect(honeypot.locator("xpath=ancestor::div[@aria-hidden='true']")).toHaveCount(1);
  });
});

test.describe("duplicate hint", () => {
  test("suggests similar Ideas while typing the title", async ({ page }) => {
    await openDialog(page);
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("offline mode");
    const hint = dialog.getByText("Similar ideas already on this board");
    await expect(hint).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Offline support" })).toBeVisible();

    await dialog.getByLabel("Title").fill("something completely different");
    await expect(hint).toHaveCount(0);
  });

  test("waits for a pause in typing before asking (300 ms debounce)", async ({ page }) => {
    let requests = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.headers()["next-action"]) requests++;
    });
    await openDialog(page);
    const title = page.getByRole("dialog").getByLabel("Title");
    await title.pressSequentially("offline", { delay: 40 });
    await expect(page.getByRole("link", { name: "Offline support" })).toBeVisible();
    // 7 keystrokes fired 1 lookup, not 7.
    expect(requests).toBe(1);
  });
});

test.describe("rate limit", () => {
  test("the 6th submission shows a slow-down error and creates nothing", async ({ page }) => {
    test.setTimeout(90_000); // six round trips in dev mode
    // Unique per run: the Sandbox board keeps earlier runs' Ideas.
    const run = Math.random().toString(36).slice(2, 8);
    for (let i = 1; i <= 5; i++) {
      await openDialog(page);
      await submit(page, `Flood ${run} ${i}`);
      await expect(page).toHaveURL(/\/ideas\//);
    }
    await openDialog(page);
    await submit(page, `Flood ${run} 6`);
    await expect(page.getByRole("alert")).toContainText("Slow down");
    await expect(page).toHaveURL(BOARD);
    await page.reload();
    await expect(page.getByText(`Flood ${run} 5`)).toBeVisible();
    await expect(page.getByText(`Flood ${run} 6`)).toHaveCount(0);
  });
});

test("a Private board's Submit button cannot be reached", async ({ page }) => {
  await page.goto("/acme/beta");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit idea" })).toHaveCount(0);
});
