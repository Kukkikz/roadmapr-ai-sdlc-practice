import { expect, type Browser, type Page } from "@playwright/test";
import { test } from "./fixtures";

const unique = () => Math.random().toString(36).slice(2, 8);

/** Creates a fresh Team (the creator is signed in as its Owner) and opens its dashboard. */
async function ownerOfNewTeam(page: Page) {
  const slug = `inv-${unique()}`;
  await page.goto("/new");
  await page.getByLabel("Team name").fill(`Team ${slug}`);
  await page.getByLabel("Team slug").fill(slug);
  await page.getByLabel("First Board name").fill("Ideas");
  await page.getByLabel("Your display name").fill("Olga");
  await page.getByRole("button", { name: "Create Team" }).click();
  await page.getByRole("link", { name: "Go to dashboard" }).click();
  await expect(page.getByRole("heading", { name: `Team ${slug}` })).toBeVisible();
  return slug;
}

async function generate(page: Page) {
  await page.getByRole("button", { name: "Generate invite link" }).click();
  const link = page.getByTestId("invite-link");
  // The browser adds the origin right after the link first renders; wait for the full URL.
  await expect(link).toHaveText(/^https?:\/\/.+\/join\/[A-Za-z0-9_-]{43}$/);
  return (await link.textContent()) ?? "";
}

/** Opens an invite link in a fresh browser (another person) and joins with a display name. */
async function join(browser: Browser, baseURL: string, link: string, name: string) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto(link);
  await page.getByLabel("Display name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { context, page };
}

test("an Owner generates an invite link once, lists it, and a person joins with it", async ({
  page,
  browser,
  baseURL,
}) => {
  await ownerOfNewTeam(page);
  await expect(page.getByRole("heading", { name: "Invite links" })).toBeVisible();
  await expect(page.getByText("No invite links yet.")).toBeVisible();

  const link = await generate(page);
  expect(link).toMatch(new RegExp(`^${baseURL}/join/[A-Za-z0-9_-]{43}$`));
  await expect(page.getByText("Copy this link now. It is shown only once.")).toBeVisible();

  // The list says when it was made and when it expires, but never shows the link again.
  const list = page.getByRole("list", { name: "Invite links" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list.getByText("Active")).toBeVisible();
  await expect(list.getByText(/Created .* · Expires /)).toBeVisible();
  await expect(list.getByText("/join/")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("invite-link")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Invite links" }).getByRole("listitem")).toHaveCount(
    1,
  );

  // Multi-use: two different people can join with the same link.
  const bo = await join(browser, baseURL!, link, "Bo");
  await expect(bo.page.getByText("Signed in as Bo (member).")).toBeVisible();
  const cy = await join(browser, baseURL!, link, "Cy");
  await expect(cy.page.getByText("Signed in as Cy (member).")).toBeVisible();

  // Members do not get the Owner's section.
  await expect(bo.page.getByRole("heading", { name: "Invite links" })).toHaveCount(0);
  await expect(bo.page.getByRole("button", { name: "Generate invite link" })).toHaveCount(0);
  await bo.context.close();
  await cy.context.close();
});

test("revoking stops new joins, keeps Members who joined, and shows as Revoked", async ({
  page,
  browser,
  baseURL,
}) => {
  await ownerOfNewTeam(page);
  const link = await generate(page);
  const early = await join(browser, baseURL!, link, "Early");

  await page.getByRole("button", { name: "Revoke" }).click();
  const list = page.getByRole("list", { name: "Invite links" });
  await expect(list.getByText("Revoked")).toBeVisible();
  await expect(page.getByRole("button", { name: "Revoke" })).toHaveCount(0);

  // The revoked link is dead for anyone new...
  const late = await browser.newContext({ baseURL: baseURL! });
  const latePage = await late.newPage();
  await latePage.goto(link);
  await expect(latePage.getByRole("heading", { name: "Link not valid" })).toBeVisible();
  await late.close();

  // ...but the Member who joined before stays signed in.
  await early.page.reload();
  await expect(early.page.getByText("Signed in as Early (member).")).toBeVisible();
  await early.context.close();
});

test("each Team sees only its own invite links", async ({ page, browser, baseURL }) => {
  await ownerOfNewTeam(page);
  await generate(page);
  await generate(page);
  await expect(page.getByRole("list", { name: "Invite links" }).getByRole("listitem")).toHaveCount(
    2,
  );

  const other = await browser.newContext({ baseURL: baseURL! });
  const otherPage = await other.newPage();
  await ownerOfNewTeam(otherPage);
  await expect(otherPage.getByText("No invite links yet.")).toBeVisible();
  await generate(otherPage);
  await expect(
    otherPage.getByRole("list", { name: "Invite links" }).getByRole("listitem"),
  ).toHaveCount(1);
  await other.close();
});

test("a signed-out visitor cannot reach the dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
