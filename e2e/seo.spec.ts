import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { createTeamKeepingOwnerLink, hydrated } from "./team-helpers";

const meta = (page: import("@playwright/test").Page, selector: string) =>
  page.locator(`head meta[${selector}]`);

test("public Board and Idea pages carry a title, description and Open Graph tags; hidden Ideas lend nothing (NF4)", async ({
  page,
  browser,
  baseURL,
}) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  await page.goto(`/${slug}/feedback`);
  await expect(page).toHaveTitle(new RegExp(`^Ideas · Team ${slug}$`));
  await expect(meta(page, 'name="description"')).toHaveAttribute("content", /.+/);
  await expect(meta(page, 'property="og:title"')).toHaveAttribute(
    "content",
    new RegExp(`^Ideas · Team ${slug}$`),
  );
  await expect(meta(page, 'property="og:description"')).toHaveAttribute("content", /.+/);
  await expect(meta(page, 'name="robots"')).toHaveCount(0);

  await page.getByRole("button", { name: "Submit idea" }).click();
  await page.getByRole("dialog").getByLabel("Title").fill("Dark mode please");
  await page.getByRole("dialog").getByLabel("Description").fill("Easier on the eyes at night.");
  await page.getByRole("dialog").getByRole("button", { name: "Submit idea" }).click();
  await expect(page).toHaveURL(/\/ideas\//);
  await hydrated(page);
  await expect(page).toHaveTitle(`Dark mode please · Ideas · Team ${slug}`);
  await expect(meta(page, 'name="description"')).toHaveAttribute(
    "content",
    "Easier on the eyes at night.",
  );

  // Hide it: a Member's tab does not borrow its title, and a Visitor gets not-found.
  const ideaUrl = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "Hide idea" }).click();
  await expect(page.getByRole("button", { name: "Unhide idea" })).toBeVisible();
  const visitor = await browser.newContext({ baseURL: baseURL! });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(ideaUrl);
  await expect(visitorPage.locator("html")).not.toContainText("Dark mode please");
  expect(await visitorPage.title()).not.toContain("Dark mode please");
  await visitor.close();
});

test("a Private Board's pages ask search engines not to index them (NF4)", async ({ page }) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  await page.getByRole("button", { name: "Edit Ideas" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Private").check();
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // The Owner is signed in, so the Private Board opens for them.
  await page.goto(`/${slug}/feedback`);
  await expect(meta(page, 'name="robots"')).toHaveAttribute("content", /noindex/);
  await page.goto(`/${slug}/feedback/roadmap`);
  await expect(meta(page, 'name="robots"')).toHaveAttribute("content", /noindex/);
});
