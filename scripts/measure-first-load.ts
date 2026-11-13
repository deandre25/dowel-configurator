/**
 * Measures the JavaScript a route actually ships on first load, by loading it
 * in a real browser against a real server and adding up what came over the
 * wire. It does not read the build manifest and does not trust a reported
 * number: a manifest can list a chunk the page never requests, and a chunk the
 * page requests can be missing from the manifest.
 *
 *   npx tsx scripts/measure-first-load.ts [--serve] [--url <url>] [--budget-kb <n>]
 *
 * --serve starts `next start` on port 3000 for the duration of the
 * measurement, so a build output can be measured in one command.
 *
 * Exits non-zero when a budget is given and exceeded.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { chromium, type Request as PlaywrightRequest } from "@playwright/test";

type Measured = {
  url: string;
  /** Response body as it came over the wire, i.e. after gzip. */
  bodyBytes: number;
  headerBytes: number;
};

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function isScript(request: PlaywrightRequest): boolean {
  return request.resourceType() === "script";
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      throw new Error(`Server at ${url} did not answer within ${timeoutMs} ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function stopServer(server: ChildProcess | undefined): Promise<void> {
  const pid = server?.pid;
  if (server === undefined || pid === undefined) {
    return;
  }
  const exited = new Promise<void>((resolve) => {
    server.once("exit", () => resolve());
  });
  // Negative pid: the whole process group, which is why it was detached.
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5_000));
  await Promise.race([exited, timeout]);
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // already gone
  }
}

async function main(): Promise<void> {
  const url = argValue("--url") ?? "http://127.0.0.1:3000/";
  const budgetKb = argValue("--budget-kb");

  let server: ChildProcess | undefined;
  if (process.argv.includes("--serve")) {
    // Its own process group, so stopping it stops `next` and not just the
    // wrapper that launched it. Leaving the server behind holds port 3000 and
    // breaks whatever runs next.
    server = spawn("npx", ["next", "start", "--port", "3000"], {
      stdio: "ignore",
      detached: true,
    });
    await waitForServer(url, 60_000);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const scripts: Measured[] = [];
  page.on("requestfinished", (request) => {
    if (!isScript(request)) {
      return;
    }
    void request.sizes().then((sizes) => {
      scripts.push({
        url: request.url(),
        bodyBytes: sizes.responseBodySize,
        headerBytes: sizes.responseHeadersSize,
      });
    });
  });

  await page.goto(url, { waitUntil: "networkidle" });
  // Nothing is lazy-loaded without an interaction on this route; give any
  // straggling response a moment to be recorded.
  await page.waitForTimeout(500);
  await browser.close();
  await stopServer(server);

  const total = scripts.reduce((sum, s) => sum + s.bodyBytes, 0);
  const headers = scripts.reduce((sum, s) => sum + s.headerBytes, 0);
  const totalKb = total / 1024;

  const rows = [...scripts].sort((a, b) => b.bodyBytes - a.bodyBytes);
  for (const row of rows) {
    const path = new URL(row.url).pathname;
    process.stdout.write(
      `${(row.bodyBytes / 1024).toFixed(1).padStart(8)} KB  ${path}\n`,
    );
  }
  process.stdout.write(
    `${"-".repeat(11)}\n${totalKb.toFixed(1).padStart(8)} KB  first-load JS, gzipped, ${scripts.length} files, ${url}\n` +
      `${(headers / 1024).toFixed(1).padStart(8)} KB  response headers for those files, not counted above\n`,
  );

  if (budgetKb !== undefined) {
    const budget = Number(budgetKb);
    if (!Number.isFinite(budget)) {
      throw new Error(`--budget-kb expects a number, got ${budgetKb}`);
    }
    if (totalKb > budget) {
      process.stdout.write(
        `\nBudget breached: ${totalKb.toFixed(1)} KB > ${budget} KB\n`,
      );
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`\nWithin budget: ${budget} KB\n`);
  }
}

void main();
