import { expect, type Browser, type Page } from "@playwright/test";

export const unique = () => Math.random().toString(36).slice(2, 8);

/** Creates a fresh Team (the creator is signed in as its Owner) and opens its dashboard. */
export async function ownerOfNewTeam(page: Page, displayName = "Olga") {
  const slug = `t-${unique()}`;
  await page.goto("/new");
  await page.getByLabel("Team name").fill(`Team ${slug}`);
  await page.getByLabel("Team slug").fill(slug);
  await page.getByLabel("First Board name").fill("Ideas");
  await page.getByLabel("Your display name").fill(displayName);
  await page.getByRole("button", { name: "Create Team" }).click();
  await page.getByRole("link", { name: "Go to dashboard" }).click();
  await expect(page.getByRole("heading", { name: `Team ${slug}` })).toBeVisible();
  return slug;
}

/** Generates an invite link on the Owner's dashboard and returns the full URL. */
export async function generateInvite(page: Page) {
  await page.getByRole("button", { name: "Generate invite link" }).click();
  const link = page.getByTestId("invite-link");
  // The browser adds the origin right after the link first renders; wait for the full URL.
  await expect(link).toHaveText(/^https?:\/\/.+\/join\/[A-Za-z0-9_-]{43}$/);
  return (await link.textContent()) ?? "";
}

/** Opens an invite link in a fresh browser (another person) and joins with a display name. */
export async function joinWithInvite(
  browser: Browser,
  baseURL: string,
  link: string,
  name: string,
) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto(link);
  await page.getByLabel("Display name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { context, page };
}

/** Creates a Team and returns the Owner link shown on the save-link card, then opens the dashboard. */
export async function createTeamKeepingOwnerLink(page: Page) {
  const slug = `ol-${unique()}`;
  await page.goto("/new");
  await page.getByLabel("Team name").fill(`Team ${slug}`);
  await page.getByLabel("Team slug").fill(slug);
  await page.getByLabel("First Board name").fill("Ideas");
  await page.getByLabel("Your display name").fill("Olga");
  await page.getByRole("button", { name: "Create Team" }).click();
  const link = page.getByTestId("owner-link");
  await expect(link).toHaveText(/^https?:\/\/.+\/login\/[A-Za-z0-9_-]{43}$/);
  const ownerLink = (await link.textContent()) ?? "";
  await page.getByRole("link", { name: "Go to dashboard" }).click();
  await expect(page.getByRole("heading", { name: `Team ${slug}` })).toBeVisible();
  return { slug, ownerLink };
}
