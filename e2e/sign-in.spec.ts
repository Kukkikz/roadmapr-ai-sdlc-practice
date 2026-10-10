import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { E2E_TOKENS } from "./tokens";

const SESSION_COOKIE = "roadmapr_session";

test("an Owner link shows Continue, signs in only on the button, and lands on the dashboard", async ({
  page,
  context,
}) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  await page.goto(`/login/${E2E_TOKENS.owner}`);
  await expect(page.getByRole("heading", { name: "Sign in to Acme" })).toBeVisible();
  // Opening the link (even twice, as a chat app pre-fetch would) signs nobody in.
  await page.reload();
  expect((await context.cookies()).some((cookie) => cookie.name === SESSION_COOKIE)).toBe(false);

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Acme" })).toBeVisible();
  await expect(page.getByText("Signed in as Ada Owner (owner).")).toBeVisible();

  // The Session cookie is HTTP-only: page scripts cannot read it.
  const cookie = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);
  expect(cookie?.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain(SESSION_COOKIE);

  // The Owner link stays valid: a second device can use it too.
  await page.goto(`/login/${E2E_TOKENS.owner}`);
  await expect(page.getByRole("heading", { name: "Sign in to Acme" })).toBeVisible();
});

test("a Member invite asks for a display name and joins the Team", async ({ page }) => {
  await page.goto(`/join/${E2E_TOKENS.invite}`);
  await expect(page.getByRole("heading", { name: "Join Acme" })).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  // The browser's own required-field check stops an empty name from being sent.
  await expect(page).toHaveURL(/\/join\//);

  await page.getByLabel("Display name").fill("Bo Builder");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Signed in as Bo Builder (member).")).toBeVisible();
});

test("revoked, expired, unknown and wrong-path links all say the link is not valid", async ({
  page,
}) => {
  const paths = [
    `/join/${E2E_TOKENS.revokedInvite}`,
    `/join/${E2E_TOKENS.expiredInvite}`,
    `/login/${"x".repeat(43)}`,
    `/login/short`,
    // An invite opened as an Owner link, and the other way round.
    `/login/${E2E_TOKENS.invite}`,
    `/join/${E2E_TOKENS.owner}`,
  ];
  for (const path of paths) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Link not valid" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
  }
});

for (const path of [`/login/${E2E_TOKENS.owner}`, `/join/${E2E_TOKENS.invite}`]) {
  test(`${path.split("/")[1]} pages are never referred, cached, framed or indexed`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    const headers = response!.headers();
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["cache-control"]).toContain("no-store");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
}
