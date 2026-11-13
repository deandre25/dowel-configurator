/**
 * What the 3D view costs once it is asked for.
 *
 * The first-load budget covers the landing route; this covers the other half
 * of that bargain — the size of the lazy payload, reported rather than hidden
 * behind the fact that it does not count against the budget.
 *
 *   npx tsx scripts/measure-scene-payload.ts [--serve] [--url <origin>]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { chromium } from "@playwright/test";

function argValue(flag: string): string | undefined {
  const index = process.argv.lastIndexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if ((await fetch(url)).ok) {
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

async function main(): Promise<void> {
  const origin = argValue("--url") ?? "http://127.0.0.1:3000";

  let server: ChildProcess | undefined;
  if (process.argv.includes("--serve")) {
    server = spawn("npx", ["next", "start", "--port", "3000"], {
      stdio: "ignore",
      detached: true,
    });
    await waitForServer(`${origin}/`, 60_000);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const byKind = new Map<string, { bytes: number; files: number }>();
  page.on("requestfinished", (request) => {
    void request.sizes().then((sizes) => {
      const kind =
        request.resourceType() === "script"
          ? "JavaScript"
          : request.url().endsWith(".hdr")
            ? "environment map"
            : request.resourceType();
      const existing = byKind.get(kind) ?? { bytes: 0, files: 0 };
      byKind.set(kind, {
        bytes: existing.bytes + sizes.responseBodySize,
        files: existing.files + 1,
      });
    });
  });

  await page.goto(`${origin}/scene?build=mixed&measure=1`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => globalThis.__dowelMeasurement?.ready === true,
    undefined,
    { timeout: 45_000 },
  );
  await page.waitForTimeout(1_500);
  await browser.close();

  let total = 0;
  process.stdout.write(
    `Everything the 3D view downloads, over the wire, ${origin}/scene\n`,
  );
  for (const [kind, { bytes, files }] of [...byKind].sort(
    (a, b) => b[1].bytes - a[1].bytes,
  )) {
    total += bytes;
    process.stdout.write(
      `${(bytes / 1024).toFixed(1).padStart(9)} KB  ${String(files).padStart(2)} file(s)  ${kind}\n`,
    );
  }
  process.stdout.write(
    `${"-".repeat(12)}\n${(total / 1024).toFixed(1).padStart(9)} KB  total\n`,
  );

  const pid = server?.pid;
  if (server !== undefined && pid !== undefined) {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}

void main();
