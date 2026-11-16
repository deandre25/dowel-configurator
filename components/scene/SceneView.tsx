"use client";

/**
 * The lazy boundary.
 *
 * Everything 3D — Three.js, R3F, drei, the assembly, the materials and the
 * environment map — is behind the dynamic import in this file, and the import
 * does not start until the view is close enough to the viewport to be worth
 * loading. A visitor who never scrolls to the configurator never downloads it.
 *
 * `ssr: false` because there is nothing useful to render on the server for a
 * WebGL canvas, and the written description below is the accessible equivalent
 * in any case — it is served with the page, it is correct before the canvas
 * exists, and it stays correct while the canvas is loading.
 */
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Configuration } from "@/lib/domain/grid";
import type { RenderStats } from "@/components/scene/Unit";
import type { CameraPreset } from "@/components/scene/Stage";
import {
  clearMeasurement,
  installMeasurement,
  measurementRequested,
  recordFrame,
  recordGpuSamples,
  type MeasurementApi,
} from "@/components/scene/measurement";

const Stage = dynamic(
  async () => {
    const loaded = await import("@/components/scene/Stage");
    return loaded.Stage;
  },
  {
    ssr: false,
    // A written loading state, not a blank rectangle and not a spinner. It
    // says what is happening and roughly how much of it there is.
    loading: () => (
      <p className="absolute inset-x-0 bottom-0 p-4 text-sm text-ink-muted">
        Drawing the unit — loading the renderer and the lighting environment,
        about 2 MB. The description and the controls do not depend on it.
      </p>
    ),
  },
);

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

/**
 * Read through `useSyncExternalStore` rather than copied into state by an
 * effect: the preference is external state that React should read, and
 * copying it in an effect means a render with the wrong answer first.
 */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    // On the server there is no preference to read, and the canvas does not
    // render there anyway.
    () => false,
  );
}

/** True once the element has been near the viewport at least once. */
function useNearViewport(
  ref: React.RefObject<HTMLElement | null>,
): boolean {
  // A browser with no IntersectionObserver gets the scene immediately rather
  // than never. Decided when the state is created, not in an effect.
  const [near, setNear] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      // Start loading a little before it is on screen, so the written state is
      // usually replaced by the time it is looked at.
      { rootMargin: "320px" },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return near;
}

type SceneViewProps = {
  readonly configuration: Configuration;
  /** The server's sentence about this build. Also the canvas's alternative. */
  readonly description: string;
  readonly preset?: CameraPreset;
};

export function SceneView({
  configuration,
  description,
  preset,
}: SceneViewProps): React.ReactElement {
  const container = useRef<HTMLDivElement>(null);
  const near = useNearViewport(container);
  const reducedMotion = usePrefersReducedMotion();

  // Measurement only: lets a script resize the unit and remount the canvas
  // before the configurator's own controls exist.
  const measuring = useMemo(() => measurementRequested(), []);
  const [override, setOverride] = useState<{
    columns: number;
    rows: number;
  } | null>(null);
  const [generation, setGeneration] = useState(0);
  const api = useRef<MeasurementApi | null>(null);

  useEffect(() => {
    if (!measuring) {
      return;
    }
    api.current = installMeasurement({
      setSize: (columns, rows) => {
        setOverride({ columns, rows });
      },
      remount: () => {
        setGeneration((value) => value + 1);
      },
    });
    return () => {
      api.current = null;
      clearMeasurement();
    };
  }, [measuring]);

  const onFrame = useCallback((stats: RenderStats, frameMs: number) => {
    const current = api.current;
    if (current !== null) {
      recordFrame(current, stats, frameMs);
    }
  }, []);

  const onGpuSamples = useCallback(
    (samples: readonly number[], available: boolean) => {
      const current = api.current;
      if (current !== null) {
        recordGpuSamples(current, samples, available);
      }
    },
    [],
  );

  const shown: Configuration =
    override === null
      ? configuration
      : { ...configuration, width: override.columns, height: override.rows };

  return (
    <div
      ref={container}
      className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-surface sm:aspect-16/10"
    >
      {/*
        The text alternative. It is the server's own sentence about the
        configuration, so it cannot describe a different unit from the one
        drawn, and a screen reader is given it rather than the canvas.
      */}
      <div role="img" aria-label={description} className="absolute inset-0">
        {near ? (
          <Stage
            key={generation}
            configuration={shown}
            instant={reducedMotion}
            {...(preset === undefined ? {} : { preset })}
            {...(measuring ? { onFrame, onGpuSamples } : {})}
          />
        ) : null}
      </div>

      {near ? null : (
        <p className="absolute inset-x-0 bottom-0 p-4 text-sm text-ink-muted">
          The three-dimensional view loads when you scroll to it. Everything
          below works without it.
        </p>
      )}
    </div>
  );
}
