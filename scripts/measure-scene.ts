/**
 * Measures the scene in a real browser and takes the screenshots.
 *
 *   npx tsx scripts/measure-scene.ts [--serve] [--url <origin>] [--out <dir>]
 *                                    [--headless]
 *
 * What it reports and how:
 *
 * - **Draw calls and triangles** come from `WebGLRenderer.info.render`, read
 *   after a frame has been drawn. That is the renderer's own counter, not an
 *   estimate from the number of parts.
 * - **Frame rate** is counted from timestamps the scene records per rendered
 *   frame, over a fixed window, while the page is actually being driven —
 *   orbited with the mouse, and resized. An idle canvas would report whatever
 *   the display refreshes at and would mean nothing.
 * - **The throttled figure** uses Chrome DevTools' `Emulation.setCPUThrottlingRate`
 *   at 4×, applied through CDP to the same page.
 *
 * Both numbers are taken from a production build served over HTTP, not from
 * the dev server.
 *
 * **It runs headed on purpose.** Headless Chromium has no GPU: it rasterises
 * WebGL through SwiftShader in software, which reported 9 fps for a scene that
 * runs at the display's refresh rate on the same machine — and barely changed
 * under a 4× CPU slowdown, because software rasterising is not what the
 * slowdown throttles. A frame rate measured there is a measurement of
 * SwiftShader. The script prints the renderer string behind every number it
 * reports, so a figure can never be read without knowing what produced it.
 * `--headless` exists for a machine with no display, and the report says so.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { EXAMPLE_NAMES, type ExampleName } from "@/lib/scene/examples";

type Stats = {
  drawCalls: number;
  triangles: number;
  instancedMeshes: number;
  geometries: number;
  programs: number;
};

function argValue(flag: string): string | undefined {
  const index = process.argv.lastIndexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
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
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
  await Promise.race([
    exited,
    new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
  ]);
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // already gone
  }
}

/** Resolves once the scene has drawn at least one frame. */
async function waitForFirstFrame(page: Page): Promise<void> {
  await page.waitForFunction(
    () => globalThis.__dowelMeasurement?.ready === true,
    undefined,
    { timeout: 45_000 },
  );
}

/**
 * How long a fixed amount of arithmetic takes in the page.
 *
 * This is the check on the throttle itself. A frame rate of 60 under a 4× CPU
 * slowdown is either a scene with headroom or a slowdown that was never
 * applied, and the two look identical in the report. Timing a known workload
 * before and after tells them apart: the ratio should be near the throttling
 * rate.
 *
 * The workload has to be big enough to measure. At eight million iterations it
 * ran in 15 ms unthrottled, and the ratio came back anywhere between 2x and
 * 4x on repeated runs — noise from JIT warm-up and CPU frequency scaling,
 * reported as though it were the throttling rate.
 */
async function busyLoopMs(page: Page): Promise<number> {
  return page.evaluate(() => {
    const started = performance.now();
    let total = 0;
    for (let index = 0; index < 60_000_000; index += 1) {
      total += Math.sqrt(index % 1_000);
    }
    // Returned so the loop cannot be optimised away.
    return performance.now() - started + total * 0;
  });
}

/**
 * The ceiling the page could reach at all: `requestAnimationFrame` ticks per
 * second with nothing being driven.
 *
 * Reported beside every frame rate, because a frame rate without its ceiling
 * is uninterpretable. The same build measured 60 fps and then 30 fps on this
 * machine with no code change between the runs — a headed browser window that
 * is not frontmost gets its animation frames capped, and "30 fps" then says
 * something about window focus rather than about the scene. With the ceiling
 * printed, that is visible instead of invisible.
 */
async function animationFrameCeiling(page: Page): Promise<number> {
  // Passed as a string rather than a function: this file is run through tsx,
  // whose esbuild step rewrites named functions to reference a `__name` helper
  // that does not exist inside the page, and the recursive tick needs a name.
  const counted: unknown = await page.evaluate(`new Promise((resolve) => {
    let ticks = 0;
    const started = performance.now();
    function tick() {
      ticks += 1;
      const elapsed = performance.now() - started;
      if (elapsed >= 1000) {
        resolve((ticks / elapsed) * 1000);
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })`);
  return typeof counted === "number" ? counted : 0;
}

/** The GPU and driver actually behind the canvas. Named with every figure. */
async function rendererName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (gl === null) {
      return "no WebGL2";
    }
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const name =
      debug === null
        ? String(gl.getParameter(gl.RENDERER))
        : String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return name;
  });
}

async function readStats(page: Page): Promise<Stats> {
  const stats = await page.evaluate(
    () => globalThis.__dowelMeasurement?.stats ?? null,
  );
  if (stats === null) {
    throw new Error("the scene reported no renderer statistics");
  }
  return stats;
}

/**
 * Frames per second over `durationMs`, while `drive` is doing something to the
 * page. Counted from the scene's own per-frame timestamps.
 */
type FrameMeasurement = {
  fps: number;
  frames: number;
  worstFrameMs: number;
  /** What the scene spent preparing a frame, which the display cap cannot hide. */
  medianWorkMs: number;
  worstWorkMs: number;
  dropped: number;
};

async function framesPerSecond(
  page: Page,
  durationMs: number,
  drive: (page: Page) => Promise<void>,
): Promise<FrameMeasurement> {
  await page.evaluate(() => {
    const api = globalThis.__dowelMeasurement;
    if (api !== undefined) {
      api.frames.length = 0;
      api.frameWork.length = 0;
    }
  });

  const started = Date.now();
  await drive(page);
  const elapsed = Math.max(Date.now() - started, 1);
  if (elapsed < durationMs * 0.6) {
    await page.waitForTimeout(durationMs - elapsed);
  }

  const timestamps = await page.evaluate(
    () => globalThis.__dowelMeasurement?.frames ?? [],
  );
  const work = await page.evaluate(
    () => globalThis.__dowelMeasurement?.frameWork ?? [],
  );
  if (timestamps.length < 2) {
    return {
      fps: 0,
      frames: timestamps.length,
      worstFrameMs: 0,
      medianWorkMs: 0,
      worstWorkMs: 0,
      dropped: 0,
    };
  }
  const first = timestamps[0] ?? 0;
  const last = timestamps[timestamps.length - 1] ?? 0;
  const span = Math.max(last - first, 1);
  let worst = 0;
  for (let index = 1; index < timestamps.length; index += 1) {
    const gap = (timestamps[index] ?? 0) - (timestamps[index - 1] ?? 0);
    worst = Math.max(worst, gap);
  }
  const sorted = [...work].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const worstWork = sorted[sorted.length - 1] ?? 0;

  // A dropped frame is a gap of more than one and a half frame periods at the
  // rate the page was actually being given.
  const period = span / (timestamps.length - 1);
  let dropped = 0;
  for (let index = 1; index < timestamps.length; index += 1) {
    const gap = (timestamps[index] ?? 0) - (timestamps[index - 1] ?? 0);
    if (gap > period * 1.5) {
      dropped += 1;
    }
  }

  return {
    fps: ((timestamps.length - 1) / span) * 1000,
    frames: timestamps.length,
    worstFrameMs: worst,
    medianWorkMs: median,
    worstWorkMs: worstWork,
    dropped,
  };
}

/** Orbits the unit with the mouse, which is the interaction a visitor has. */
async function orbit(page: Page): Promise<void> {
  const box = await page.locator('[role="img"]').first().boundingBox();
  if (box === null) {
    throw new Error("could not find the canvas to orbit");
  }
  const centreX = box.x + box.width / 2;
  const centreY = box.y + box.height / 2;
  await page.mouse.move(centreX, centreY);
  await page.mouse.down();
  // `steps` interpolates inside the browser, so the drive is not one CDP round
  // trip per mouse position — which was itself costing more than the frames.
  for (let lap = 0; lap < 4; lap += 1) {
    await page.mouse.move(centreX + 120, centreY + 30, { steps: 24 });
    await page.mouse.move(centreX - 120, centreY - 20, { steps: 24 });
  }
  await page.mouse.up();
}

/** Resizes the unit repeatedly, which is the transition being measured. */
async function resize(page: Page): Promise<void> {
  const sizes: readonly [number, number][] = [
    [6, 5],
    [2, 2],
    [6, 2],
    [3, 5],
    [6, 5],
    [4, 3],
  ];
  for (const [columns, rows] of sizes) {
    await page.evaluate(
      ([c, r]) => {
        globalThis.__dowelMeasurement?.setSize(c ?? 4, r ?? 3);
      },
      [columns, rows],
    );
    await page.waitForTimeout(420);
  }
}

type Profile = {
  readonly label: string;
  readonly viewport: { width: number; height: number };
  readonly deviceScaleFactor: number;
  readonly cpuThrottling: number;
};

/**
 * Two profiles. The desktop one is a retina window, which is what a visitor on
 * this machine would actually see. The mobile one is a phone's viewport and
 * pixel ratio with the 4× CPU slowdown the brief asks for — a throttled
 * desktop window is not a phone, and the pixel count is half the story.
 */
const PROFILES: readonly Profile[] = [
  {
    label: "desktop, retina, no throttling",
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 2,
    cpuThrottling: 1,
  },
  {
    label: "phone viewport, dpr 3, 4x CPU slowdown",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    cpuThrottling: 4,
  },
];

async function main(): Promise<void> {
  const origin = argValue("--url") ?? "http://127.0.0.1:3000";
  const outDir = argValue("--out") ?? "docs/screenshots";
  const headless = process.argv.includes("--headless");
  mkdirSync(outDir, { recursive: true });

  let server: ChildProcess | undefined;
  if (process.argv.includes("--serve")) {
    server = spawn("npx", ["next", "start", "--port", "3000"], {
      stdio: "ignore",
      detached: true,
    });
    await waitForServer(`${origin}/`, 60_000);
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 2,
    // The scene honours prefers-reduced-motion; the measurement wants the
    // animated path, so it asks for motion explicitly.
    reducedMotion: "no-preference",
  });

  const rows: string[] = [];
  let renderer = "unknown";

  for (const build of EXAMPLE_NAMES) {
    const page = await context.newPage();
    await page.goto(`${origin}/scene?build=${build}&measure=1`, {
      waitUntil: "domcontentloaded",
    });
    await waitForFirstFrame(page);
    // Let the grow-in transition finish before the picture is taken.
    await page.waitForTimeout(1_200);

    renderer = await rendererName(page);
    const stats = await readStats(page);
    const target = join(outDir, `${build}.png`);
    await page.locator('[role="img"]').first().screenshot({ path: target });
    rows.push(
      `${build.padEnd(8)} draw calls ${String(stats.drawCalls).padStart(3)}  ` +
        `triangles ${String(stats.triangles).padStart(6)}  ` +
        `instanced meshes drawn ${String(stats.instancedMeshes).padStart(2)}  ` +
        `geometries ${String(stats.geometries).padStart(2)}  ` +
        `programs ${String(stats.programs).padStart(2)}  -> ${target}`,
    );
    await page.close();
  }

  process.stdout.write(
    `\nDraw calls, from WebGLRenderer.info.render, ${headless ? "headless" : "headed"} Chromium\n` +
      `  renderer: ${renderer}\n`,
  );
  for (const row of rows) {
    process.stdout.write(`  ${row}\n`);
  }
  await context.close();

  // Frame rate, on the heaviest unit, driven two ways, in each profile.
  const heaviest: ExampleName = "maximum";
  process.stdout.write(
    `\nFrame rate on the ${heaviest} unit, counted from rendered frames\n`,
  );

  for (const profile of PROFILES) {
    const profileContext = await browser.newContext({
      viewport: profile.viewport,
      deviceScaleFactor: profile.deviceScaleFactor,
      reducedMotion: "no-preference",
      hasTouch: profile.cpuThrottling > 1,
    });
    const page = await profileContext.newPage();
    const cdp = await profileContext.newCDPSession(page);
    await page.goto(`${origin}/scene?build=${heaviest}&measure=1`, {
      waitUntil: "domcontentloaded",
    });
    await waitForFirstFrame(page);
    await page.waitForTimeout(1_000);
    const profileRenderer = await rendererName(page);
    // A backgrounded window has its animation frames capped, so the figures
    // below would measure window focus rather than the scene.
    await page.bringToFront();

    // Run the workload once and discard it: the first execution pays for
    // compilation, which would make the throttling ratio look smaller than it
    // is.
    await busyLoopMs(page);
    const unthrottledMs = await busyLoopMs(page);
    await cdp.send("Emulation.setCPUThrottlingRate", {
      rate: profile.cpuThrottling,
    });
    // One warm-up second under the new rate before anything is counted.
    await page.waitForTimeout(1_000);
    const throttledMs = await busyLoopMs(page);
    const observedRate = throttledMs / Math.max(unthrottledMs, 0.001);

    const ceiling = await animationFrameCeiling(page);
    const orbiting = await framesPerSecond(page, 1_800, orbit);
    const resizing = await framesPerSecond(page, 2_600, resize);

    const pixels =
      profile.viewport.width *
      profile.deviceScaleFactor *
      profile.viewport.height *
      profile.deviceScaleFactor;
    const throttleNote =
      profile.cpuThrottling === 1
        ? "no throttling requested"
        : `requested ${String(profile.cpuThrottling)}x, measured ${observedRate.toFixed(2)}x ` +
          `(a fixed JS workload took ${unthrottledMs.toFixed(0)} ms then ${throttledMs.toFixed(0)} ms)`;

    process.stdout.write(
      `  ${profile.label}\n` +
        `    renderer: ${profileRenderer}, ${String(Math.round(pixels / 10_000) / 100)} megapixels\n` +
        `    throttle: ${throttleNote}\n` +
        `    ceiling: ${ceiling.toFixed(1)} fps — requestAnimationFrame with nothing driven\n` +
        `    orbiting ${orbiting.fps.toFixed(1).padStart(5)} fps over ${String(orbiting.frames)} frames, ` +
        `${String(orbiting.dropped)} dropped, scene work ${orbiting.medianWorkMs.toFixed(2)} ms median / ` +
        `${orbiting.worstWorkMs.toFixed(2)} ms worst\n` +
        `    resizing ${resizing.fps.toFixed(1).padStart(5)} fps over ${String(resizing.frames)} frames, ` +
        `${String(resizing.dropped)} dropped, scene work ${resizing.medianWorkMs.toFixed(2)} ms median / ` +
        `${resizing.worstWorkMs.toFixed(2)} ms worst\n`,
    );

    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await cdp.detach();
    await profileContext.close();
  }

  await browser.close();
  await stopServer(server);
}

void main();
