/**
 * GPU time per frame, via `EXT_disjoint_timer_query_webgl2`.
 *
 * Why this exists: the frame figure reported at the Phase 3 gate was
 * `performance.now()` around the work the scene does before the draw, which is
 * the **CPU** issuing commands, not the GPU executing them. For eighteen draw
 * calls, 0.1 ms is submission cost and says nothing about fill rate — which is
 * exactly what will matter on a phone, where the pixels, the filtered
 * environment map and the variance shadow map are the expense and a CPU
 * throttle touches none of them.
 *
 * The extension is asynchronous: a query is started, the frame is drawn, the
 * query is ended, and the result becomes available some frames later. It is
 * also allowed to tell you the GPU was interrupted, in which case the sample
 * is thrown away rather than reported.
 *
 * It is not available everywhere — Safari does not expose it, and a browser
 * may withhold it for fingerprinting reasons. When it is missing the scene
 * says so rather than reporting a zero.
 */

type TimerExtension = {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
};

type PendingQuery = {
  readonly query: WebGLQuery;
};

export type GpuTimer = {
  /** Call immediately before the frame is drawn. */
  begin(): void;
  /** Call immediately after. Returns any samples that have become available. */
  end(): readonly number[];
  dispose(): void;
  readonly available: boolean;
};

/** Used when the renderer is not backed by a context that can time itself. */
export const UNSUPPORTED_CONTEXT: GpuTimer = {
  begin: () => undefined,
  end: () => [],
  dispose: () => undefined,
  available: false,
};

const UNAVAILABLE: GpuTimer = {
  begin: () => undefined,
  end: () => [],
  dispose: () => undefined,
  available: false,
};

export function createGpuTimer(gl: WebGL2RenderingContext): GpuTimer {
  const extension = gl.getExtension(
    "EXT_disjoint_timer_query_webgl2",
  ) as TimerExtension | null;

  if (extension === null) {
    return UNAVAILABLE;
  }

  const pending: PendingQuery[] = [];
  let active: WebGLQuery | null = null;

  return {
    available: true,

    begin() {
      if (active !== null) {
        return;
      }
      const query = gl.createQuery();
      if (query === null) {
        return;
      }
      gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
      active = query;
    },

    end() {
      if (active !== null) {
        gl.endQuery(extension.TIME_ELAPSED_EXT);
        pending.push({ query: active });
        active = null;
      }

      const ready: number[] = [];
      // A disjoint means the GPU was interrupted and every outstanding sample
      // is meaningless, so they are dropped rather than averaged in.
      const disjoint = gl.getParameter(extension.GPU_DISJOINT_EXT) as boolean;

      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const entry = pending[index];
        if (entry === undefined) {
          continue;
        }
        const done = gl.getQueryParameter(
          entry.query,
          gl.QUERY_RESULT_AVAILABLE,
        ) as boolean;
        if (!done) {
          continue;
        }
        if (!disjoint) {
          const nanoseconds = gl.getQueryParameter(
            entry.query,
            gl.QUERY_RESULT,
          ) as number;
          ready.push(nanoseconds / 1_000_000);
        }
        gl.deleteQuery(entry.query);
        pending.splice(index, 1);
      }

      return ready;
    },

    dispose() {
      if (active !== null) {
        gl.endQuery(extension.TIME_ELAPSED_EXT);
        gl.deleteQuery(active);
        active = null;
      }
      for (const entry of pending) {
        gl.deleteQuery(entry.query);
      }
      pending.length = 0;
    },
  };
}
