import { expect, type BrowserContext, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { E2E_TOKENS } from "./tokens";

const SESSION_COOKIE = "roadmapr_session";

async function signInAsOwner(page: Page) {
  await page.goto(`/login/${E2E_TOKENS.owner}`);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const sessionCookie = async (context: BrowserContext) =>
  (await context.cookies()).find((cookie) => cookie.name === SESSION_COOKIE);

test("Sign out ends the Session on the server, not just in the browser (US-3.5)", async ({
  page,
  context,
}) => {
  await signInAsOwner(page);
  const copied = await sessionCookie(context);
  expect(copied).toBeDefined();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await sessionCookie(context)).toBeUndefined();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  // Putting the old cookie back changes nothing: the Session no longer exists.
  await context.addCookies([copied!]);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("signing in again replaces the Session the browser held", async ({ page, context }) => {
  await signInAsOwner(page);
  const first = await sessionCookie(context);

  await signInAsOwner(page);
  const second = await sessionCookie(context);
  expect(second?.value).not.toBe(first?.value);

  await context.clearCookies();
  await context.addCookies([first!]);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("a signed-in Member votes as themselves, not as their anonymous identity (G1)", async ({
  page,
}) => {
  const vote = () =>
    page
      .getByRole("list", { name: "Ideas" })
      .getByRole("listitem")
      .filter({ hasText: "Member vote" })
      .getByRole("button", { name: /^Upvote/ });

  await signInAsOwner(page);
  await page.goto("/acme/sandbox");
  await expect(vote()).toHaveAttribute("aria-pressed", "false");
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && "next-action" in response.request().headers(),
  );
  await vote().click();
  await answered;
  await expect(vote()).toHaveAttribute("aria-pressed", "true");
  await expect(vote()).toHaveAccessibleName("Upvote, 1 vote");

  // Signed out, the same browser is an anonymous Visitor: the Member's vote is not theirs.
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/acme/sandbox");
  await expect(vote()).toHaveAttribute("aria-pressed", "false");
  await expect(vote()).toHaveAccessibleName("Upvote, 1 vote");
});
