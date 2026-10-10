import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { generateInvite, joinWithInvite, unique } from "./team-helpers";

/** Creates a Team and returns the Owner link shown on the save-link card, then opens the dashboard. */
async function createTeamKeepingOwnerLink(page: Page) {
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

test("replacing the Owner link shows the new one once and kills the old one (US-3.2)", async ({
  page,
  browser,
  baseURL,
}) => {
  const { ownerLink: oldLink } = await createTeamKeepingOwnerLink(page);
  await expect(page.getByRole("heading", { name: "Owner link" })).toBeVisible();

  await page.getByRole("button", { name: "Replace Owner link" }).click();
  const fresh = page.getByTestId("new-owner-link");
  await expect(fresh).toHaveText(/^https?:\/\/.+\/login\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByText("It is shown only once.").first()).toBeVisible();
  const newLink = (await fresh.textContent()) ?? "";
  expect(newLink).not.toBe(oldLink);

  // The owner stays signed in here.
  await page.reload();
  await expect(page.getByText("Signed in as Olga (owner).")).toBeVisible();
  await expect(page.getByTestId("new-owner-link")).toHaveCount(0);

  // On another device the old link is dead and the new one works.
  const device = await browser.newContext({ baseURL: baseURL! });
  const devicePage = await device.newPage();
  await devicePage.goto(oldLink);
  await expect(devicePage.getByRole("heading", { name: "Link not valid" })).toBeVisible();
  await devicePage.goto(newLink);
  await devicePage.getByRole("button", { name: "Continue" }).click();
  await expect(devicePage).toHaveURL(/\/dashboard$/);
  await expect(devicePage.getByText("Signed in as Olga (owner).")).toBeVisible();
  await device.close();
});

test("Members do not get the Owner link section (US-3.6)", async ({ page, browser, baseURL }) => {
  await createTeamKeepingOwnerLink(page);
  const invite = await generateInvite(page);
  const bo = await joinWithInvite(browser, baseURL!, invite, "Bo");
  await expect(bo.page.getByRole("heading", { name: "Owner link" })).toHaveCount(0);
  await expect(bo.page.getByRole("button", { name: "Replace Owner link" })).toHaveCount(0);
  await bo.context.close();
});
