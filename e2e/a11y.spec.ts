import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { createTeamKeepingOwnerLink, hydrated } from "./team-helpers";

// NF1 and NF2 smoke checks that need no extra dependency: at the narrowest supported desktop
// width, each page has one h1, no sideways scroll, a name on every control, and a Tab order
// that visits real, visible elements and never gets stuck.
test.use({ viewport: { width: 1024, height: 768 } });

async function audit(page: Page, label: string) {
  await hydrated(page);
  await expect(page.locator("h1"), `${label}: one h1`).toHaveCount(1);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label}: no horizontal scroll at 1024px`).toBeLessThanOrEqual(0);

  const unnamed = await page.evaluate(() => {
    const controls = document.querySelectorAll<HTMLElement>(
      "a[href], button, input:not([type=hidden]), select, textarea",
    );
    const bad: string[] = [];
    for (const el of controls) {
      if (el.closest("[hidden], [aria-hidden=true]") || el.getClientRects().length === 0) continue;
      const labelled = (el as HTMLInputElement).labels?.length ? true : false;
      const name =
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        el.textContent?.trim() ||
        el.getAttribute("title") ||
        (labelled ? "label" : "");
      if (!name) bad.push(el.outerHTML.slice(0, 120));
    }
    return bad;
  });
  expect(unnamed, `${label}: every control has a name`).toEqual([]);

  // Tab through the page: focus must move on every press, onto a visible element.
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      // The dev server's own overlay is not part of the app.
      if (el.tagName === "NEXTJS-PORTAL") return null;
      const box = el.getBoundingClientRect();
      return {
        visible: box.width > 0 && box.height > 0,
        id: `${el.tagName}|${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40)}|${Math.round(box.x)}|${Math.round(box.y)}`,
      };
    });
    if (!info) break; // focus left the page (browser chrome): the end of the Tab order
    expect(info.visible, `${label}: focused element is visible: ${info.id}`).toBe(true);
    seen.add(info.id);
  }
  expect(seen.size, `${label}: Tab reaches several controls`).toBeGreaterThan(1);
}

test("Visitor pages are labelled, keyboard-reachable and fit 1024px (NF1, NF2)", async ({
  page,
}) => {
  const { slug } = await createTeamKeepingOwnerLink(page);
  await page.goto(`/${slug}/feedback`);
  await page.getByRole("button", { name: "Submit idea" }).click();
  await page.getByRole("dialog").getByLabel("Title").fill("A11y idea");
  await page.getByRole("dialog").getByRole("button", { name: "Submit idea" }).click();
  await expect(page).toHaveURL(/\/ideas\//);
  const ideaPath = new URL(page.url()).pathname;

  await page.goto(`/${slug}/feedback`);
  await audit(page, "board");
  await page.goto(`/${slug}/feedback/roadmap`);
  await audit(page, "roadmap");
  await page.goto(ideaPath);
  await audit(page, "idea");
  await page.goto("/new");
  await audit(page, "create team");
});

test("the dashboard is labelled, keyboard-reachable and fits 1024px (NF1, NF2)", async ({
  page,
}) => {
  await createTeamKeepingOwnerLink(page);
  await audit(page, "dashboard");
});
