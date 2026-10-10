import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { generateInvite, joinWithInvite, ownerOfNewTeam } from "./team-helpers";

const SESSION_COOKIE = "roadmapr_session";

test("everyone sees who is on the Team, but only Owners get Remove (US-3.4)", async ({
  page,
  browser,
  baseURL,
}) => {
  await ownerOfNewTeam(page);
  const invite = await generateInvite(page);
  const bo = await joinWithInvite(browser, baseURL!, invite, "Bo");
  await joinWithInvite(browser, baseURL!, invite, "Cy").then((cy) => cy.context.close());

  await page.reload();
  const members = page.getByRole("list", { name: "Members" });
  await expect(members.getByRole("listitem")).toHaveCount(3);
  await expect(members.getByRole("listitem").nth(0)).toContainText("Olga (you)");
  await expect(members.getByRole("listitem").nth(0)).toContainText("Owner");
  await expect(members.getByText("Bo", { exact: true })).toBeVisible();

  // Owners can remove the others, not themselves; Members cannot remove anyone.
  await expect(page.getByRole("button", { name: "Remove Bo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Cy" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Olga" })).toHaveCount(0);
  await bo.page.reload(); // Bo opened his dashboard before Cy joined
  await expect(bo.page.getByRole("list", { name: "Members" }).getByRole("listitem")).toHaveCount(3);
  await expect(bo.page.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
  await bo.context.close();
});

test("removing a Member ends their sessions at once and keeps everyone else in (US-3.4)", async ({
  page,
  browser,
  baseURL,
}) => {
  await ownerOfNewTeam(page);
  const invite = await generateInvite(page);
  const bo = await joinWithInvite(browser, baseURL!, invite, "Bo");
  const cy = await joinWithInvite(browser, baseURL!, invite, "Cy");
  const boCookie = (await bo.context.cookies()).find((c) => c.name === SESSION_COOKIE)!;

  await page.reload();
  await page.getByRole("button", { name: "Remove Bo" }).click();
  const members = page.getByRole("list", { name: "Members" });
  await expect(members.getByRole("listitem")).toHaveCount(2);
  await expect(members.getByText("Bo", { exact: true })).toHaveCount(0);

  // Bo is out on his next request, and a copy of his cookie is useless.
  await bo.page.reload();
  await expect(bo.page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  const stranger = await browser.newContext({ baseURL: baseURL! });
  await stranger.addCookies([boCookie]);
  const strangerPage = await stranger.newPage();
  await strangerPage.goto("/dashboard");
  await expect(strangerPage.getByRole("heading", { name: "Page not found" })).toBeVisible();

  // Cy is untouched.
  await cy.page.reload();
  await expect(cy.page.getByText("Signed in as Cy (member).")).toBeVisible();
  await Promise.all([bo.context.close(), cy.context.close(), stranger.close()]);
});

test("a Member can leave: signed out, sent home, and gone from the list (US-3.7)", async ({
  page,
  browser,
  baseURL,
}) => {
  await ownerOfNewTeam(page);
  const invite = await generateInvite(page);
  const cy = await joinWithInvite(browser, baseURL!, invite, "Cy");

  await cy.page.getByRole("button", { name: "Leave Team" }).click();
  await expect(cy.page).toHaveURL(/\/$/);
  await expect(cy.page.getByRole("link", { name: "Create a Team" })).toBeVisible();
  expect((await cy.context.cookies()).some((c) => c.name === SESSION_COOKIE)).toBe(false);
  await cy.page.goto("/dashboard");
  await expect(cy.page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("list", { name: "Members" }).getByRole("listitem")).toHaveCount(1);
  await cy.context.close();
});

test("the last Owner cannot leave and is pointed to deleting the Team (US-3.7)", async ({
  page,
}) => {
  await ownerOfNewTeam(page);
  await expect(page.getByText("You are the last Owner, so you cannot leave.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Leave Team" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
});
