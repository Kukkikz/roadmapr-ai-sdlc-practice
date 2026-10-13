import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { createTeamKeepingOwnerLink, hydrated } from "./team-helpers";

/**
 * The whole loop across roles: a Visitor submits an Idea and upvotes a second one, the Owner
 * signs in again with the Owner link on another device, moves the Idea to Planned from the
 * queue, and everyone then finds it on the roadmap with its vote.
 */
test("submit idea, upvote, sign in with the Owner link, change status, see it on the roadmap", async ({
  page,
  browser,
  baseURL,
}) => {
  const { slug, ownerLink } = await createTeamKeepingOwnerLink(page);

  const visitor = await browser.newContext({ baseURL: baseURL! });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/${slug}/feedback`);
  await visitorPage.getByRole("button", { name: "Submit idea" }).click();
  await visitorPage.getByRole("dialog").getByLabel("Title").fill("Export to CSV");
  await visitorPage.getByRole("dialog").getByRole("button", { name: "Submit idea" }).click();
  await expect(visitorPage).toHaveURL(/\/ideas\//);
  await hydrated(visitorPage);

  const vote = visitorPage.getByRole("button", { name: /^Upvote/ });
  await expect(vote).toHaveAccessibleName("Upvote, 0 votes");
  await vote.click();
  await expect(vote).toHaveAccessibleName("Upvote, 1 vote");
  await expect(vote).toHaveAttribute("aria-pressed", "true");

  // The Owner comes back on another device with only the Owner link.
  const owner = await browser.newContext({ baseURL: baseURL! });
  const ownerPage = await owner.newPage();
  await ownerPage.goto(ownerLink);
  await ownerPage.getByRole("button", { name: "Continue" }).click();
  await expect(ownerPage).toHaveURL(/\/dashboard$/);
  await hydrated(ownerPage);

  const queue = ownerPage.getByRole("region", { name: "To review" });
  await expect(queue.getByRole("link", { name: "Export to CSV" })).toBeVisible();
  await ownerPage
    .getByRole("combobox", { name: "Status of Export to CSV" })
    .selectOption("planned");
  await queue.getByRole("button", { name: "Change status" }).click();
  await expect(queue.getByText("Nothing to review")).toBeVisible();

  // The Visitor sees it on the roadmap, under Planned, with the vote they cast.
  await visitorPage.goto(`/${slug}/feedback/roadmap`);
  const planned = visitorPage.getByRole("region", { name: "Planned" });
  await expect(planned.getByText("Export to CSV")).toBeVisible();
  await expect(planned.getByRole("button", { name: /^Upvote, 1 vote/ })).toBeVisible();

  await visitor.close();
  await owner.close();
});
