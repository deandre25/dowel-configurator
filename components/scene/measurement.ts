/**
 * The measurement hook the scripts in `scripts/` drive the scene through.
 *
 * It exists because the numbers this project reports — draw calls, frame rate
 * under a throttled CPU, whether memory comes back after twenty mounts — have
 * to be taken from the real renderer, and before Phase 4 there are no controls
 * to take them through. "It feels smooth" is not a measurement, and neither is
 * a number read off a different build.
 *
 * It is installed only when the page is asked for with `?measure=1`, so it is
 * absent from the page a visitor loads. It reports; it is not a control
 * surface, and nothing in the interface reads it.
 */
import type { RenderStats } from "@/components/scene/Unit";

export type MeasurementApi = {
  /** The most recent frame's renderer counters. */
  stats: RenderStats | null;
  /** `performance.now()` of each rendered frame, most recent last. */
  frames: number[];
  /**
   * Milliseconds the scene itself spent preparing each of those frames.
   *
   * This is the figure that survives a capped display: frames per second tells
   * you what the browser handed out, while this tells you what the scene cost,
   * and only the second one is a property of the code.
   */
  frameWork: number[];
  /** Resizes the unit, so a transition can be measured before controls exist. */
  setSize: (columns: number, rows: number) => void;
  /** Unmounts and remounts the canvas, for the disposal check. */
  remount: () => void;
  /** True once the first frame has been rendered. */
  ready: boolean;
};

declare global {
  var __dowelMeasurement: MeasurementApi | undefined;
}

export function measurementRequested(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("measure") === "1";
}

export function installMeasurement(
  api: Omit<MeasurementApi, "stats" | "frames" | "frameWork" | "ready">,
): MeasurementApi {
  const existing = globalThis.__dowelMeasurement;
  const installed: MeasurementApi = {
    stats: existing?.stats ?? null,
    frames: existing?.frames ?? [],
    frameWork: existing?.frameWork ?? [],
    ready: existing?.ready ?? false,
    ...api,
  };
  globalThis.__dowelMeasurement = installed;
  return installed;
}

export function recordFrame(
  api: MeasurementApi,
  stats: RenderStats,
  frameMs: number,
): void {
  api.stats = stats;
  api.ready = true;
  api.frames.push(performance.now());
  api.frameWork.push(frameMs);
  // Keep the last few seconds at 144 fps and no more.
  if (api.frames.length > 1_000) {
    api.frames.splice(0, api.frames.length - 1_000);
    api.frameWork.splice(0, api.frameWork.length - 1_000);
  }
}

export function clearMeasurement(): void {
  globalThis.__dowelMeasurement = undefined;
}
