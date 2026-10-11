import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { createTeamKeepingOwnerLink, hydrated } from "./team-helpers";

test("a Member changes an Idea's status; Visitors see it but get no control (US-5.1)", async ({
  page,
  browser,
  baseURL,
}) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  await page.goto(`/${slug}/feedback`);
  await page.getByRole("button", { name: "Submit idea" }).click();
  await page.getByRole("dialog").getByLabel("Title").fill("Dark mode please");
  await page.getByRole("dialog").getByRole("button", { name: "Submit idea" }).click();
  await expect(page).toHaveURL(/\/ideas\//);
  const ideaUrl = new URL(page.url()).pathname;
  await hydrated(page);

  const badge = page.getByRole("article").locator('[data-slot="badge"]');
  await expect(badge.getByText("Open", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Status" }).selectOption("planned");
  await page.getByRole("button", { name: "Change status" }).click();
  await expect(badge.getByText("Planned", { exact: true })).toBeVisible();

  // The Idea now shows in the roadmap's Planned column.
  await page.goto(`/${slug}/feedback/roadmap`);
  await expect(page.getByText("Dark mode please")).toBeVisible();

  const visitor = await browser.newContext({ baseURL: baseURL! });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(ideaUrl);
  await expect(
    visitorPage
      .getByRole("article")
      .locator('[data-slot="badge"]')
      .getByText("Planned", { exact: true }),
  ).toBeVisible();
  await expect(visitorPage.getByRole("combobox", { name: "Status" })).toHaveCount(0);
  await expect(visitorPage.getByRole("button", { name: "Change status" })).toHaveCount(0);
  await visitor.close();
});
