import { expect, test } from "@playwright/test";

test("the landing page states what the product is", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Build a shelving unit to the size of the wall you have",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Dowel is a fictional company", { exact: false }),
  ).toBeVisible();
});

test("the GraphQL endpoint answers the health query", async ({ request }) => {
  const response = await request.post("/api/graphql", {
    data: { query: "{ health { ok schemaVersion } }" },
  });
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  expect(body).toMatchObject({
    data: { health: { ok: true, schemaVersion: "1" } },
  });
});
