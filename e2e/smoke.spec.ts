import { expect, test } from "@playwright/test";

test("home page renders the product name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Roadmapr" })).toBeVisible();
});

test("page uses the DESIGN.md font and colours", async ({ page }) => {
  await page.goto("/");
  const styles = await page.locator("body").evaluate((el) => {
    const s = getComputedStyle(el);
    return { font: s.fontFamily, color: s.color, background: s.backgroundColor };
  });
  expect(styles.font).toContain("Inter");
  expect(styles.color).toBe("rgb(24, 29, 38)"); // ink #181d26
  expect(styles.background).toBe("rgb(255, 255, 255)"); // canvas #ffffff
});
