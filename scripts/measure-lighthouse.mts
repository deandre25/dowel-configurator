/**
 * Lighthouse against the deployed site.
 *
 *   node --experimental-strip-types scripts/measure-lighthouse.mts \
 *     [--url <url>] [--runs 5] [--desktop]
 *
 * Run through Node's own type stripping rather than tsx. tsx's esbuild step
 * keeps function names by injecting a `__name` helper, and Lighthouse
 * serialises functions into the page to run them there — where that helper
 * does not exist. The failure is `__name is not defined` from inside the
 * browser, which says nothing about the cause.
 *
 * Five runs by default, reported as the median. One Lighthouse run is noisy
 * enough that a single score says more about the network that minute than
 * about the page: on this project the spread between the best and worst
 * performance run was large enough to cross the pass mark in both directions.
 * The median of five is the number worth defending, and the spread is printed
 * beside it so nobody has to take the median on trust.
 *
 * Mobile is the default profile, which is what Lighthouse throttles hardest
 * and what the brief asks for.
 */
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

type Scores = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
};

const CATEGORY_KEYS: readonly (keyof Scores)[] = [
  "performance",
  "accessibility",
  "bestPractices",
  "seo",
];

function argValue(flag: string): string | undefined {
  const index = process.argv.lastIndexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

async function runOnce(url: string, desktop: boolean): Promise<Scores> {
  const chrome = await launch({
    chromeFlags: ["--headless=new", "--no-sandbox"],
  });
  try {
    const result = await lighthouse(
      url,
      {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        onlyCategories: [
          "performance",
          "accessibility",
          "best-practices",
          "seo",
        ],
        formFactor: desktop ? "desktop" : "mobile",
        screenEmulation: desktop
          ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
          : { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
      },
    );
    if (result === undefined) {
      throw new Error("Lighthouse returned no result");
    }
    const categories = result.lhr.categories;
    const score = (key: string): number =>
      Math.round((categories[key]?.score ?? 0) * 100);
    return {
      performance: score("performance"),
      accessibility: score("accessibility"),
      bestPractices: score("best-practices"),
      seo: score("seo"),
    };
  } finally {
    await chrome.kill();
  }
}

async function main(): Promise<void> {
  const url = argValue("--url") ?? "https://dowel-configurator.vercel.app/";
  const runs = Number(argValue("--runs") ?? "5");
  const desktop = process.argv.includes("--desktop");

  process.stdout.write(
    `Lighthouse, ${desktop ? "desktop" : "mobile"} profile, ${String(runs)} runs\n  ${url}\n\n`,
  );

  const results: Scores[] = [];
  for (let run = 1; run <= runs; run += 1) {
    const scores = await runOnce(url, desktop);
    results.push(scores);
    process.stdout.write(
      `  run ${String(run)}: performance ${String(scores.performance)}  ` +
        `accessibility ${String(scores.accessibility)}  ` +
        `best practices ${String(scores.bestPractices)}  ` +
        `SEO ${String(scores.seo)}\n`,
    );
  }

  process.stdout.write("\n  median of " + String(runs) + " runs\n");
  for (const key of CATEGORY_KEYS) {
    const values = results.map((result) => result[key]);
    const label =
      key === "bestPractices"
        ? "best practices"
        : key === "seo"
          ? "SEO"
          : key;
    process.stdout.write(
      `    ${label.padEnd(14)} ${String(median(values)).padStart(3)}   ` +
        `(worst ${String(Math.min(...values))}, best ${String(Math.max(...values))})\n`,
    );
  }
}

void main();
