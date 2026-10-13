import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { generateInvite, hydrated, joinWithInvite, ownerOfNewTeam } from "./team-helpers";

test("a Member creates, renames, recolours and deletes a Tag from the dashboard (US-5.2)", async ({
  page,
  browser,
  baseURL,
}) => {
  await ownerOfNewTeam(page);
  const invite = await generateInvite(page);

  // A plain Member, not an Owner, manages Tags too.
  const { context, page: member } = await joinWithInvite(browser, baseURL!, invite, "Mika");
  await hydrated(member);
  await member.getByRole("button", { name: "Tags for Ideas" }).click();
  const dialog = member.getByRole("dialog");
  await expect(dialog.getByText("No Tags yet")).toBeVisible();

  await dialog.getByLabel("New Tag", { exact: true }).fill("billing");
  await dialog.getByLabel("Colour of the new Tag").selectOption("blue");
  await dialog.getByRole("button", { name: "Add Tag" }).click();
  const tags = dialog.getByRole("list", { name: "Tags" });
  await expect(tags.getByLabel("Name of Tag billing")).toHaveValue("billing");
  await expect(tags.getByLabel("Colour of Tag billing")).toHaveValue("blue");

  // A name already on the Board (ignoring case) is refused with a message.
  await dialog.getByLabel("New Tag", { exact: true }).fill("BILLING");
  await dialog.getByRole("button", { name: "Add Tag" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(/already exists/);
  await expect(tags.getByRole("listitem")).toHaveCount(1);

  // Rename and recolour.
  await tags.getByLabel("Name of Tag billing").fill("payments");
  await tags.getByLabel("Colour of Tag billing").selectOption("green");
  await tags.getByRole("button", { name: "Save" }).click();
  await expect(tags.getByLabel("Name of Tag payments")).toHaveValue("payments");
  await expect(tags.getByLabel("Colour of Tag payments")).toHaveValue("green");

  // Delete.
  await tags.getByRole("button", { name: "Delete Tag payments" }).click();
  await expect(dialog.getByText("No Tags yet")).toBeVisible();
  await context.close();
});
