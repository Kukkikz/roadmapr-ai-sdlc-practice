import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { createTeamKeepingOwnerLink, generateInvite, joinWithInvite } from "./team-helpers";

test("the dashboard lists the Team's Boards, and an Owner creates another (US-4.1)", async ({
  page,
}) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  const boards = page.getByRole("list", { name: "Boards" });
  await expect(boards.getByRole("listitem")).toHaveCount(1);
  await expect(boards.getByRole("link", { name: "Ideas" })).toHaveAttribute(
    "href",
    `/${slug}/feedback`,
  );
  await expect(boards.getByText("Public")).toBeVisible();

  await page.getByRole("button", { name: "Create board" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Board name").fill("Roadmap talk");
  // The slug follows the name until edited by hand.
  await expect(dialog.getByLabel("Board slug")).toHaveValue("roadmap-talk");
  await expect(dialog.getByText(`/${slug}/roadmap-talk`)).toBeVisible();
  await dialog.getByLabel("Description (optional)").fill("Where we talk plans");
  await dialog.getByRole("button", { name: "Create board" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(boards.getByRole("listitem")).toHaveCount(2);
  await boards.getByRole("link", { name: "Roadmap talk" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/roadmap-talk$`));
  await expect(page.getByRole("heading", { name: "Roadmap talk", level: 1 })).toBeVisible();
  await expect(page.getByText("Where we talk plans")).toBeVisible();
});

test("a taken or reserved Board slug is a field error and keeps what was typed", async ({
  page,
}) => {
  await createTeamKeepingOwnerLink(page);
  await page.getByRole("button", { name: "Create board" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Board name").fill("Second");
  await dialog.getByLabel("Board slug").fill("feedback");
  await dialog.getByRole("button", { name: "Create board" }).click();
  await expect(dialog.getByText("This slug is taken in your Team.")).toBeVisible();
  await expect(dialog.getByLabel("Board name")).toHaveValue("Second");

  await dialog.getByLabel("Board slug").fill("roadmap");
  await dialog.getByRole("button", { name: "Create board" }).click();
  await expect(dialog.getByText("This slug is reserved.")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("list", { name: "Boards" }).getByRole("listitem")).toHaveCount(1);
});

test("Members see the Boards but cannot create one (US-3.6)", async ({
  page,
  browser,
  baseURL,
}) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  const invite = await generateInvite(page);
  const bo = await joinWithInvite(browser, baseURL!, invite, "Bo");
  const boards = bo.page.getByRole("list", { name: "Boards" });
  await expect(boards.getByRole("link", { name: "Ideas" })).toHaveAttribute(
    "href",
    `/${slug}/feedback`,
  );
  await expect(bo.page.getByRole("button", { name: "Create board" })).toHaveCount(0);
  await bo.context.close();
});

test("going Back from a Board does not bring a shown-once invite link back (US-4.3 follow-up)", async ({
  page,
}) => {
  await createTeamKeepingOwnerLink(page);
  await generateInvite(page);
  await expect(page.getByTestId("invite-link")).toBeVisible();

  await page.getByRole("list", { name: "Boards" }).getByRole("link", { name: "Ideas" }).click();
  await expect(page).toHaveURL(/\/feedback$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Boards" })).toBeVisible();
  await expect(page.getByTestId("invite-link")).toHaveCount(0);
});
