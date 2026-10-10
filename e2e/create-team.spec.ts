import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";

const unique = () => Math.random().toString(36).slice(2, 8);

async function fillForm(page: Page, slug: string, overrides: { teamName?: string } = {}) {
  await page.goto("/new");
  await page.getByLabel("Team name").fill(overrides.teamName ?? `Team ${slug}`);
  await page.getByLabel("Team slug").fill(slug);
  await page.getByLabel("First Board name").fill("Feature requests");
  await page.getByLabel("Your display name").fill("Grace");
}

test("the home page leads to the form, which suggests a slug from the Team name", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Create a Team" }).click();
  await expect(page).toHaveURL(/\/new$/);
  await page.getByLabel("Team name").fill("Acme Widgets & Co");
  await expect(page.getByLabel("Team slug")).toHaveValue("acme-widgets-co");
  // Once edited by hand the slug stops following the name.
  await page.getByLabel("Team slug").fill("widgets");
  await page.getByLabel("Team name").fill("Something else");
  await expect(page.getByLabel("Team slug")).toHaveValue("widgets");
});

test("creates a Team, shows the Owner link once, and signs the creator in", async ({
  page,
  browser,
  baseURL,
}) => {
  const slug = `e2e-${unique()}`;
  await fillForm(page, slug);
  await page.getByRole("button", { name: "Create Team" }).click();

  await expect(page.getByRole("heading", { name: `Team ${slug} is ready` })).toBeVisible();
  await expect(page.getByText("It is shown only once.")).toBeVisible();
  const link = (await page.getByTestId("owner-link").textContent()) ?? "";
  expect(link).toMatch(new RegExp(`^${baseURL}/login/[A-Za-z0-9_-]{43}$`));
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();

  // The creator is signed in already.
  await page.getByRole("link", { name: "Go to dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: `Team ${slug}` })).toBeVisible();
  await expect(page.getByText("Signed in as Grace (owner).")).toBeVisible();

  // The first Board exists and is public.
  await page.goto(`/${slug}/feature-requests`);
  await expect(page.getByRole("heading", { name: "Feature requests" })).toBeVisible();

  // The link is gone for good once the page is left...
  await page.goto("/new");
  await expect(page.getByTestId("owner-link")).toHaveCount(0);

  // ...but the copy we saved signs the Owner in on another device.
  const other = await browser.newContext({ baseURL: baseURL! });
  const device = await other.newPage();
  await device.goto(link);
  await expect(device.getByRole("heading", { name: `Sign in to Team ${slug}` })).toBeVisible();
  await device.getByRole("button", { name: "Continue" }).click();
  await expect(device).toHaveURL(/\/dashboard$/);
  await expect(device.getByText("Signed in as Grace (owner).")).toBeVisible();
  await other.close();
});

test("the Copy button puts the shown Owner link on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await fillForm(page, `e2e-${unique()}`);
  await page.getByRole("button", { name: "Create Team" }).click();
  const link = (await page.getByTestId("owner-link").textContent()) ?? "";
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
});

test("says so when the link cannot be copied", async ({ page }) => {
  await fillForm(page, `e2e-${unique()}`);
  await page.getByRole("button", { name: "Create Team" }).click();
  await expect(page.getByTestId("owner-link")).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
  });
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByText("Could not copy. Select the link above")).toBeVisible();
});

test("shows field errors for a reserved or taken slug and creates nothing", async ({ page }) => {
  await fillForm(page, "login");
  await page.getByRole("button", { name: "Create Team" }).click();
  await expect(page.getByText("This slug is reserved. Choose another.")).toBeVisible();
  await expect(page.getByTestId("owner-link")).toHaveCount(0);

  // What was typed survives the error, so only the slug needs fixing.
  await expect(page.getByLabel("First Board name")).toHaveValue("Feature requests");
  await expect(page.getByLabel("Your display name")).toHaveValue("Grace");
  await page.getByLabel("Team slug").fill("acme");
  await page.getByRole("button", { name: "Create Team" }).click();
  await expect(page.getByText("This slug is taken. Choose another.")).toBeVisible();
  await expect(page.getByTestId("owner-link")).toHaveCount(0);
});

test("the 4th Team from one IP in an hour is refused", async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await fillForm(page, `e2e-${unique()}`);
    await page.getByRole("button", { name: "Create Team" }).click();
    await expect(page.getByTestId("owner-link")).toBeVisible();
  }
  await fillForm(page, `e2e-${unique()}`);
  await page.getByRole("button", { name: "Create Team" }).click();
  await expect(page.getByText("Slow down and try again in an hour.")).toBeVisible();
  await expect(page.getByTestId("owner-link")).toHaveCount(0);
});
