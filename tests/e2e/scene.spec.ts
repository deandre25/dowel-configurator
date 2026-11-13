import { expect, test } from "@playwright/test";

/**
 * These assert the part of the scene route that does not need a GPU: the
 * written description, the example builds, and the text alternative on the
 * canvas.
 *
 * Nothing here waits for WebGL. In CI the browser is headless and rasterises
 * WebGL in software, so a test that waited for a drawn frame would be timing
 * SwiftShader. The scene's own numbers are taken by
 * `scripts/measure-scene.ts`, which runs against a real GPU and says which
 * one.
 */
test("the scene route describes the unit in words", async ({ page }) => {
  await page.goto("/scene?build=mixed");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The unit");

  // The server's own sentence, which is also the canvas's text alternative.
  const described = page.getByText(
    "A 5-column, 4-row unit in oak, holding 2 open shelves",
    { exact: false },
  );
  await expect(described).toBeVisible();
});

test("the canvas carries the configuration as its text alternative", async ({
  page,
}) => {
  await page.goto("/scene?build=minimum");

  const view = page.getByRole("img");
  await expect(view).toHaveAttribute(
    "aria-label",
    /A 2-column, 2-row unit in oak, holding 1 open shelf/,
  );
});

test("the text alternative changes with the configuration", async ({
  page,
}) => {
  await page.goto("/scene?build=minimum");
  const minimum = await page.getByRole("img").getAttribute("aria-label");

  await page.goto("/scene?build=maximum");
  const maximum = await page.getByRole("img").getAttribute("aria-label");

  expect(minimum).not.toBe(maximum);
  expect(maximum).toContain("6-column, 5-row");
  expect(maximum).toContain("centre support");
});

test("every example build is reachable without the canvas", async ({
  page,
}) => {
  await page.goto("/scene");

  for (const label of ["Smallest unit", "Doors and drawers", "Largest unit"]) {
    await expect(page.getByRole("link", { name: label })).toBeVisible();
  }

  await page.getByRole("link", { name: "Largest unit" }).click();
  await expect(page).toHaveURL(/build=maximum/);
  await expect(page.getByRole("img")).toHaveAttribute(
    "aria-label",
    /6-column, 5-row/,
  );
});

test("an unknown build falls back rather than failing", async ({ page }) => {
  const response = await page.goto("/scene?build=nonsense&view=sideways");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("img")).toHaveAttribute(
    "aria-label",
    /A \d-column, \d-row unit/,
  );
});
