/**
 * axe against the deployed site, in every state it has.
 *
 *   node --experimental-strip-types scripts/check-accessibility.mts [--url <origin>]
 *
 * Three states, because they are three different documents:
 *
 * 1. The landing route before the configurator is asked for — server-rendered
 *    HTML and one button.
 * 2. The landing route after it is mounted — the table of bays, the controls,
 *    the price panel, the live region and the canvas.
 * 3. A share link, which opens straight onto a saved build.
 *
 * Scanning only the first would be scanning the state with almost nothing in
 * it. The mounted state is where every control, label and live region lives,
 * and it is a DOM the first scan never sees.
 *
 * Run through Node's type stripping rather than tsx: axe is injected into the
 * page and tsx's name-preserving transform does not survive the trip.
 */
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Page } from "playwright";

type Finding = {
  readonly id: string;
  readonly impact: string;
  readonly nodes: number;
  readonly help: string;
};

function argValue(flag: string): string | undefined {
  const index = process.argv.lastIndexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

/** WCAG 2.2 A and AA, which is the bar this claims to meet. */
async function scan(page: Page, label: string): Promise<readonly Finding[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const findings = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact ?? "unknown",
    nodes: violation.nodes.length,
    help: violation.help,
  }));

  process.stdout.write(
    `  ${label.padEnd(44)} ${String(results.passes.length).padStart(3)} checks passed, ` +
      `${String(findings.length)} violations\n`,
  );
  for (const finding of findings) {
    process.stdout.write(
      `      ${finding.impact}: ${finding.id} — ${finding.help} (${String(finding.nodes)} nodes)\n`,
    );
  }
  return findings;
}

async function main(): Promise<void> {
  const origin = argValue("--url") ?? "https://dowel-configurator.vercel.app";
  const shareId = argValue("--share") ?? "PMJTQPK3";

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 412, height: 823 },
    deviceScaleFactor: 2,
  });

  process.stdout.write(`axe-core, WCAG 2.2 A and AA\n  ${origin}\n\n`);
  let total = 0;

  const page = await context.newPage();
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { level: 1 }).waitFor();
  total += (await scan(page, "landing route, before the configurator")).length;

  await page.getByRole("button", { name: "Build a unit" }).click();
  // Wait for the price, which means the catalogue loaded and the server
  // answered: the DOM is complete.
  await page.getByText("Total price:").waitFor({ timeout: 60_000 });
  // And for the canvas, which is a further change to the document.
  await page.locator("canvas").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1_500);
  total += (await scan(page, "landing route, configurator mounted")).length;

  const shared = await context.newPage();
  await shared.goto(`${origin}/u/${shareId}`, {
    waitUntil: "domcontentloaded",
  });
  await shared.getByText("Total price:").waitFor({ timeout: 60_000 });
  await shared.locator("canvas").waitFor({ timeout: 60_000 });
  await shared.waitForTimeout(1_500);
  total += (await scan(shared, `share link /u/${shareId}`)).length;

  await browser.close();

  process.stdout.write(`\n  ${String(total)} violations in total\n`);
  if (total > 0) {
    process.exitCode = 1;
  }
}

void main();
