"use client";

/**
 * Reports a lost — and a restored — WebGL context to React, which cannot
 * otherwise find out.
 *
 * `webglcontextlost` fires on the canvas element itself and does not bubble,
 * so it is listened for on `gl.domElement` from inside the canvas tree, where
 * the renderer is reachable.
 *
 * **`preventDefault` is required, not optional.** The browser only sends
 * `webglcontextrestored` if the loss was cancelled; without it the context is
 * gone for good. An earlier version of this file deliberately did not call it,
 * reasoning that a machine which drops one context will drop the next — which
 * is true of a crashing driver and wrong about the common case. A mobile
 * browser releases the context routinely when a tab is backgrounded and
 * restores it on return, and refusing the restore there means someone who
 * changed apps for fifteen seconds comes back to a view that only a reload can
 * fix.
 *
 * The canvas must also stay mounted while the context is lost. The restore
 * event is delivered to the element that lost it; unmounting the canvas throws
 * away the only thing that could hear it.
 */
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

type ContextLossWatcherProps = {
  readonly onLost: () => void;
  readonly onRestored: () => void;
};

export function ContextLossWatcher({
  onLost,
  onRestored,
}: ContextLossWatcherProps): null {
  const canvas = useThree((state) => state.gl.domElement);

  useEffect(() => {
    const lost = (event: Event): void => {
      // Without this the loss is final and no restore will ever be sent.
      event.preventDefault();
      onLost();
    };
    const restored = (): void => {
      onRestored();
    };

    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
    };
  }, [canvas, onLost, onRestored]);

  return null;
}
