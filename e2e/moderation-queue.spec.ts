import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { createTeamKeepingOwnerLink, hydrated } from "./team-helpers";

test("Visitor Ideas land in the dashboard queue and leave it once reviewed (US-5.5, US-5.1)", async ({
  page,
  browser,
  baseURL,
}) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  const queue = page.getByRole("region", { name: "To review" });
  await expect(queue.getByText("Nothing to review")).toBeVisible();

  // A Visitor submits two Ideas; opening them as the submitter is not a Member's review.
  const visitor = await browser.newContext({ baseURL: baseURL! });
  const visitorPage = await visitor.newPage();
  for (const title of ["First idea", "Second idea"]) {
    await visitorPage.goto(`/${slug}/feedback`);
    await visitorPage.getByRole("button", { name: "Submit idea" }).click();
    await visitorPage.getByRole("dialog").getByLabel("Title").fill(title);
    await visitorPage.getByRole("dialog").getByRole("button", { name: "Submit idea" }).click();
    await expect(visitorPage).toHaveURL(/\/ideas\//);
  }
  await visitor.close();

  await page.goto("/dashboard");
  await hydrated(page);
  const rows = queue.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Second idea");
  await expect(rows.last()).toContainText("First idea");

  // Changing the status from the dashboard takes that Idea off the queue.
  await page.getByRole("combobox", { name: "Status of Second idea" }).selectOption("planned");
  await rows.first().getByRole("button", { name: "Change status" }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("First idea");

  // Opening the other one does too.
  await rows.first().getByRole("link", { name: "First idea" }).click();
  await expect(page.getByRole("heading", { name: "First idea" })).toBeVisible();
  await page.goto("/dashboard");
  await expect(queue.getByText("Nothing to review")).toBeVisible();
});
