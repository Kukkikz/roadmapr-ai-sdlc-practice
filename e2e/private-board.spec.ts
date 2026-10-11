import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";
import {
  createTeamKeepingOwnerLink,
  generateInvite,
  hydrated,
  joinWithInvite,
} from "./team-helpers";

const NOT_FOUND = { name: "Page not found" };

/** Makes the Team's first Board Private from the Owner's dashboard. */
async function makeIdeasPrivate(page: Page) {
  await page.getByRole("button", { name: "Edit Ideas" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Private").check();
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Boards" }).getByText("Private")).toBeVisible();
}

/** Opens the Edit dialog of the Private board and makes (or rotates) the share link. */
async function shareLink(page: Page, buttonName: string) {
  await page.getByRole("button", { name: "Edit Ideas" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: buttonName }).click();
  const link = dialog.getByTestId("share-link");
  await expect(link).toHaveText(/^https?:\/\/.+\/join\/board\/[A-Za-z0-9_-]{43}$/);
  const url = (await link.textContent()) ?? "";
  await dialog.getByRole("button", { name: "Cancel" }).click();
  return url;
}

test("a Private board is not found without its link, opens with it, and rotating ends access (US-4.2, US-2.4)", async ({
  page,
  browser,
  baseURL,
}) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  await makeIdeasPrivate(page);
  const board = `/${slug}/feedback`;

  // A stranger sees the same page as for an unknown Board.
  const visitor = await browser.newContext({ baseURL });
  const guest = await visitor.newPage();
  await guest.goto(board);
  await expect(guest.getByRole("heading", NOT_FOUND)).toBeVisible();

  // The Owner's Team can open it without a link.
  await page.goto(board);
  await expect(page.getByRole("heading", { name: "Ideas", level: 1 })).toBeVisible();
  await page.goto("/dashboard");

  const first = await shareLink(page, "Generate share link");
  // Opening the link only shows "Continue"; the board is still hidden until it is pressed.
  await guest.goto(first);
  await expect(guest.getByRole("heading", { name: "Open Ideas" })).toBeVisible();
  await guest.goto(board);
  await expect(guest.getByRole("heading", NOT_FOUND)).toBeVisible();

  await guest.goto(first);
  await guest.getByRole("button", { name: "Continue" }).click();
  await expect(guest).toHaveURL(new RegExp(`${board}$`));
  await expect(guest.getByRole("heading", { name: "Ideas", level: 1 })).toBeVisible();

  // The guest takes part exactly as on a public board.
  await guest.getByRole("button", { name: "Submit idea" }).click();
  await guest.getByRole("dialog").getByLabel("Title").fill("From a guest");
  await guest.getByRole("dialog").getByRole("button", { name: "Submit idea" }).click();
  await expect(guest.getByRole("heading", { level: 1, name: "From a guest" })).toBeVisible();

  // Rotating ends the access the old link gave, and the old link no longer works.
  await page.goto("/dashboard");
  await hydrated(page);
  const second = await shareLink(page, "Rotate share link");
  expect(second).not.toBe(first);
  await guest.goto(board);
  await expect(guest.getByRole("heading", NOT_FOUND)).toBeVisible();
  await guest.goto(first);
  await expect(guest.getByRole("heading", { name: "Link not valid" })).toBeVisible();

  // The new link works, and the earlier Idea is still there.
  await guest.goto(second);
  await guest.getByRole("button", { name: "Continue" }).click();
  await expect(guest.getByRole("list", { name: "Ideas" })).toContainText("From a guest");
  await visitor.close();
});

test("an unknown share link says it is not valid; switching back to Public opens the Board again (US-2.4, US-4.1)", async ({
  page,
  browser,
  baseURL,
}) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  await makeIdeasPrivate(page);

  const visitor = await browser.newContext({ baseURL });
  const guest = await visitor.newPage();
  await guest.goto(`/join/board/${"A".repeat(43)}`);
  await expect(guest.getByRole("heading", { name: "Link not valid" })).toBeVisible();

  await page.getByRole("button", { name: "Edit Ideas" }).click();
  await page.getByRole("dialog").getByLabel("Public").check();
  await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await guest.goto(`/${slug}/feedback`);
  await expect(guest.getByRole("heading", { name: "Ideas", level: 1 })).toBeVisible();
  await visitor.close();
});

test("a Member of another Team and a plain Member see Private boards as the Team's own people do (G3)", async ({
  page,
  browser,
  baseURL,
}) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  await makeIdeasPrivate(page);
  const invite = await generateInvite(page);

  // A Member of the same Team opens it, and cannot make share links.
  const bo = await joinWithInvite(browser, baseURL!, invite, "Bo");
  await bo.page.goto(`/${slug}/feedback`);
  await expect(bo.page.getByRole("heading", { name: "Ideas", level: 1 })).toBeVisible();
  await bo.page.goto("/dashboard");
  await expect(bo.page.getByRole("button", { name: /^Edit / })).toHaveCount(0);

  // An Owner of another Team does not get in.
  const other = await browser.newContext({ baseURL });
  const otherPage = await other.newPage();
  await createTeamKeepingOwnerLink(otherPage, "Eve");
  await otherPage.goto(`/${slug}/feedback`);
  await expect(otherPage.getByRole("heading", NOT_FOUND)).toBeVisible();
  await other.close();
  await bo.context.close();
});
