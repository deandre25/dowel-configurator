/**
 * The deployed check: does the live site actually work?
 *
 *   node --experimental-strip-types scripts/check-deployed.mts [--url <origin>]
 *
 * Local verification is not verification. Everything this project measures
 * locally can be true while the deployed site is broken — a missing
 * environment variable, a runtime that behaves differently, a build that
 * succeeded and a function that cannot reach the database. That last one
 * actually happened here: the site was live and answering for two days with
 * `database: false`, and nothing in CI knew.
 *
 * So this asserts, against the real URL:
 *
 * 1. The document is server-rendered — the heading is in the HTML, with no
 *    JavaScript involved.
 * 2. The page hydrates — a control that only works once React has taken over
 *    is used, and the result observed.
 * 3. The API answers and **can reach Postgres**, separately reported.
 * 4. A configuration prices, to a known total.
 * 5. A configuration saves and restores to the same build.
 * 6. A share link's preview describes the build rather than the site.
 */
import { chromium } from "playwright";

type Check = { readonly name: string; readonly ok: boolean; readonly detail: string };

function argValue(flag: string): string | undefined {
  const index = process.argv.lastIndexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
}

async function graphql(
  origin: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(`${origin}/api/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`GraphQL endpoint returned ${String(response.status)}`);
  }
  const body = (await response.json()) as { data?: unknown; errors?: unknown };
  if (body.errors !== undefined) {
    throw new Error(`GraphQL errors: ${JSON.stringify(body.errors)}`);
  }
  return body.data;
}

/** A 3 × 3 oak unit with a drawer, a shelf and a door: £493.10. */
const KNOWN_INPUT = {
  width: 3,
  height: 3,
  finish: "OAK",
  modules: [
    { type: "DRAWER", column: 0, row: 0 },
    { type: "SHELF", column: 1, row: 1 },
    { type: "DOOR", column: 2, row: 0 },
  ],
};
const KNOWN_TOTAL_CENTS = 49_310;

async function main(): Promise<void> {
  const origin = (
    argValue("--url") ??
    process.env["DEPLOYED_URL"] ??
    "https://dowel-configurator.vercel.app"
  ).replace(/\/$/, "");

  process.stdout.write(`Checking the deployed site\n  ${origin}\n\n`);

  // 1. Server-rendered, before any JavaScript runs.
  try {
    const html = await (await fetch(`${origin}/`)).text();
    const rendered = html.includes(
      "Build a shelving unit to the size of the wall you have",
    );
    record(
      "the landing route is server-rendered",
      rendered,
      rendered ? "heading present in the HTML" : "heading missing from the HTML",
    );
  } catch (error) {
    record("the landing route is server-rendered", false, String(error));
  }

  // 3. The API answers, and whether it can reach Postgres, reported apart.
  try {
    const data = (await graphql(origin, "{ health { ok database schemaVersion } }")) as {
      health: { ok: boolean; database: boolean; schemaVersion: string };
    };
    record("the API answers", data.health.ok, `schema version ${data.health.schemaVersion}`);
    record(
      "the API can reach Postgres",
      data.health.database,
      data.health.database
        ? "health.database is true"
        : "health.database is false — the deployment has no working connection string",
    );
  } catch (error) {
    record("the API answers", false, String(error));
    record("the API can reach Postgres", false, "health query failed");
  }

  // 4. A configuration prices, to a figure computed from the catalogue.
  try {
    const data = (await graphql(
      origin,
      `mutation Price($input: ConfigurationInput!) {
         priceConfiguration(input: $input) {
           __typename
           ... on PricedConfiguration { price { totalCents currency } }
         }
       }`,
      { input: KNOWN_INPUT },
    )) as {
      priceConfiguration: {
        __typename: string;
        price?: { totalCents: number; currency: string };
      };
    };
    const total = data.priceConfiguration.price?.totalCents;
    record(
      "a configuration prices correctly",
      total === KNOWN_TOTAL_CENTS,
      `expected ${String(KNOWN_TOTAL_CENTS)}, got ${String(total)}`,
    );
  } catch (error) {
    record("a configuration prices correctly", false, String(error));
  }

  // 5. Save, then restore.
  let savedId: string | null = null;
  try {
    const saved = (await graphql(
      origin,
      `mutation Save($input: ConfigurationInput!) {
         saveConfiguration(input: $input) {
           __typename
           ... on SavedConfiguration { id price { totalCents } }
         }
       }`,
      { input: KNOWN_INPUT },
    )) as {
      saveConfiguration: { __typename: string; id?: string };
    };
    savedId = saved.saveConfiguration.id ?? null;
    record(
      "a configuration saves",
      savedId !== null && /^[0-9A-HJ-KM-NP-TV-Z]{8}$/.test(savedId),
      savedId === null ? "no id returned" : `id ${savedId}`,
    );
  } catch (error) {
    record("a configuration saves", false, String(error));
  }

  if (savedId !== null) {
    try {
      const restored = (await graphql(
        origin,
        `query Restore($id: ID!) {
           configuration(id: $id) {
             id
             configuration { width height finish modules { type column row } }
             price { totalCents }
           }
         }`,
        { id: savedId },
      )) as {
        configuration: {
          configuration: { width: number; height: number; finish: string };
          price: { totalCents: number };
        } | null;
      };
      const same =
        restored.configuration !== null &&
        restored.configuration.configuration.width === KNOWN_INPUT.width &&
        restored.configuration.configuration.height === KNOWN_INPUT.height &&
        restored.configuration.configuration.finish === KNOWN_INPUT.finish &&
        restored.configuration.price.totalCents === KNOWN_TOTAL_CENTS;
      record(
        "a saved configuration restores",
        same,
        same ? `${savedId} round-tripped` : "the restored build differs",
      );
    } catch (error) {
      record("a saved configuration restores", false, String(error));
    }

    // 6. The share preview describes the build.
    try {
      const html = await (await fetch(`${origin}/u/${savedId}`)).text();
      const specific =
        html.includes("shelving unit") && html.includes("£493.10");
      record(
        "a share link previews the build",
        specific,
        specific ? "title and description carry the build" : "generic metadata",
      );
    } catch (error) {
      record("a share link previews the build", false, String(error));
    }
  }

  // 2. Hydration: a control that only works once React has taken over.
  //
  // WebGL is switched off for this one. The check is asking whether the page
  // hydrates and prices from the server, and a headless browser has no GPU —
  // it software-rasterises the scene on the main thread, which blocked the
  // render and made this step time out at random. With no WebGL the canvas
  // falls back to its written description, the rest of the interface is
  // untouched, and the question being asked is the one being answered.
  const browser = await chromium.launch({
    args: ["--disable-webgl", "--disable-webgl2"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Build a unit" }).click();
    await page.getByText("Total price:").waitFor({ timeout: 60_000 });
    const priced = await page.getByText("Total price: £493.10").isVisible();
    record(
      "the page hydrates and prices from the server",
      priced,
      priced ? "the configurator mounted and showed a server price" : "no price appeared",
    );
  } catch (error) {
    record("the page hydrates and prices from the server", false, String(error));
  } finally {
    await browser.close();
  }

  let failures = 0;
  for (const check of checks) {
    if (!check.ok) {
      failures += 1;
    }
    process.stdout.write(
      `  ${check.ok ? "pass" : "FAIL"}  ${check.name.padEnd(44)} ${check.detail}\n`,
    );
  }

  process.stdout.write(
    `\n  ${String(checks.length - failures)} of ${String(checks.length)} checks passed\n`,
  );
  if (failures > 0) {
    process.exitCode = 1;
  }
}

void main();
