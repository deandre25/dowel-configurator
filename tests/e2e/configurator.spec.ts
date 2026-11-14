import { expect, test, type Page } from "@playwright/test";

/**
 * The configurator, driven entirely through the non-canvas controls.
 *
 * Not one of these tests touches the 3D view, which is the point: everything a
 * visitor can do to a unit is reachable from the table and the radio groups,
 * and the canvas is a view of that rather than the way in.
 *
 * The prices asserted here were computed from the catalogue by hand — frame
 * 17950, 2175 per bay, 1395/4795/5595 per module, ×1.00 / ×1.08 / ×1.05 — and
 * they come from the server. Nothing in the browser computes a price.
 */

/** The starting unit: 3 × 3 oak, a drawer, a shelf and a door. */
const START_TOTAL = "£493.10";

/**
 * The headline total, by its label rather than its text: the same amount
 * appears again as the subtotal and on the finish line, so matching on the
 * figure alone matches three elements.
 */
function total(page: Page, amount: string) {
  return page.getByText(`Total price: ${amount}`);
}

async function openConfigurator(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Build a unit" }).click();
  await expect(total(page, START_TOTAL)).toBeVisible({ timeout: 30_000 });
}

/** The select for one bay, addressed the way a screen reader would. */
function bay(page: Page, column: number, row: string) {
  return page.getByLabel(`Bay in column ${String(column)}, ${row}`);
}

test("builds a unit through the controls and prices it on the server", async ({
  page,
}) => {
  await openConfigurator(page);

  // 17950 frame + 9 bays x 2175 + 1395 shelf + 4795 drawer + 5595 door.
  await expect(total(page, START_TOTAL)).toBeVisible();

  // Every line of the price comes from the server, including the breakdown.
  await expect(page.getByRole("row", { name: /Frame/ })).toContainText(
    "£179.50",
  );
  await expect(page.getByRole("row", { name: /Bays/ })).toContainText("£195.75");
});

test("re-prices when the finish changes, without reloading", async ({
  page,
}) => {
  await openConfigurator(page);

  await page.getByRole("radio", { name: "Charcoal" }).check();
  // 49310 x 1.08 = 53254.8, rounded to 53255.
  await expect(total(page, "£532.55")).toBeVisible();

  await page.getByRole("radio", { name: "White" }).check();
  // 49310 x 1.05 = 51775.5, rounded to 51776.
  await expect(total(page, "£517.76")).toBeVisible();
});

test("re-prices when a bay changes", async ({ page }) => {
  await openConfigurator(page);

  // Empty the drawer in the bottom-left bay: 49310 - 4795 = 44515.
  await bay(page, 1, "bottom row").selectOption("EMPTY");
  await expect(total(page, "£445.15")).toBeVisible();
});

test("shows the rule beside the bay that broke it", async ({ page }) => {
  await openConfigurator(page);

  await bay(page, 1, "top row").selectOption("DRAWER");

  await expect(
    page.getByText("A drawer cannot go in the top row", { exact: false }),
  ).toBeVisible();
  // No price is shown for a unit that cannot be built.
  await expect(
    page.getByText("This unit cannot be built as it stands", { exact: false }),
  ).toBeVisible();
});

test("a door takes the bay above it, and says so", async ({ page }) => {
  await openConfigurator(page);

  // The unit starts with a door in column 3, so one upper half already exists.
  await expect(page.getByText("Door, upper half")).toHaveCount(1);

  await bay(page, 1, "bottom row").selectOption("DOOR");

  // Now there are two, and the bay above the new door has stopped being a
  // control at all — it belongs to the door below it.
  await expect(page.getByText("Door, upper half")).toHaveCount(2);
  await expect(bay(page, 1, "row 2")).toHaveCount(0);

  // 49310 - 4795 drawer + 5595 door = 50110.
  await expect(total(page, "£501.10")).toBeVisible();
});

test("a wide unit reserves a bay for the centre support", async ({ page }) => {
  await openConfigurator(page);

  await page.getByRole("radio", { name: "5", exact: true }).first().check();

  // Scoped to the table: the columns hint mentions the centre support too.
  await expect(
    page.getByRole("table").getByText("Centre support"),
  ).toBeVisible();
  // And it is in the bottom row, where the rules put it.
  await expect(
    page.getByRole("row", { name: /^Bottom row/ }).getByText("Centre support"),
  ).toBeVisible();
});

test("saves a build and restores it from the link in a fresh context", async ({
  page,
  browser,
}) => {
  await openConfigurator(page);

  await page.getByRole("radio", { name: "Charcoal" }).check();
  await expect(total(page, "£532.55")).toBeVisible();

  await page.getByRole("button", { name: "Save this build" }).click();

  const link = page.getByLabel("Link to this build");
  await expect(link).toBeVisible({ timeout: 30_000 });
  const shareUrl = await link.inputValue();
  expect(shareUrl).toMatch(/\/u\/[0-9A-HJ-KM-NP-TV-Z]{8}$/);

  // A new context: no storage, no cache, nothing carried over.
  const fresh = await browser.newContext();
  const restored = await fresh.newPage();
  await restored.goto(shareUrl);

  await expect(total(restored, "£532.55")).toBeVisible({ timeout: 30_000 });
  await expect(
    restored.getByRole("radio", { name: "Charcoal" }),
  ).toBeChecked();
  await expect(
    restored.getByLabel("Bay in column 1, bottom row"),
  ).toHaveValue("DRAWER");
  await expect(restored.getByLabel("Bay in column 3, bottom row")).toHaveValue(
    "DOOR",
  );

  await fresh.close();
});

test("the same build saved twice keeps the same link", async ({ page }) => {
  await openConfigurator(page);

  await page.getByRole("button", { name: "Save this build" }).click();
  const link = page.getByLabel("Link to this build");
  await expect(link).toBeVisible({ timeout: 30_000 });
  const first = await link.inputValue();

  // Change something and change it back: a different object, the same build.
  await page.getByRole("radio", { name: "White" }).check();
  await expect(total(page, "£517.76")).toBeVisible();
  await page.getByRole("radio", { name: "Oak" }).check();
  await expect(total(page, START_TOTAL)).toBeVisible();

  await page.getByRole("button", { name: "Save this build" }).click();
  await expect(link).toBeVisible();
  expect(await link.inputValue()).toBe(first);
});

test("an unknown share link offers a unit to start from", async ({ page }) => {
  await page.goto("/u/ZZZZZZZZ");
  await expect(
    page.getByText("That link does not match a saved build", { exact: false }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(total(page, START_TOTAL)).toBeVisible();
});

test("the canvas describes the unit, and the description follows the build", async ({
  page,
}) => {
  await openConfigurator(page);

  const view = page.getByRole("img");
  await expect(view).toHaveAttribute(
    "aria-label",
    /3-column, 3-row unit in oak/,
  );

  await page.getByRole("radio", { name: "5", exact: true }).first().check();
  await expect(view).toHaveAttribute("aria-label", /5-column, 3-row unit/, {
    timeout: 15_000,
  });
});
