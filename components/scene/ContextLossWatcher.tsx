"use client";

/**
 * Reports a lost WebGL context to React, which cannot otherwise find out.
 *
 * `webglcontextlost` fires on the canvas element itself and does not bubble,
 * so it is listened for on `gl.domElement` from inside the canvas tree, where
 * the renderer is reachable.
 *
 * `preventDefault` is deliberately not called. Calling it asks the browser to
 * restore the context later, and this unmounts the canvas instead: a context
 * dropped once on a machine short of graphics memory tends to be dropped
 * again, and a view that flickers between working and broken is worse than
 * one that stops and says so.
 */
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

type ContextLossWatcherProps = {
  readonly onLost: () => void;
};

export function ContextLossWatcher({
  onLost,
}: ContextLossWatcherProps): null {
  const canvas = useThree((state) => state.gl.domElement);

  useEffect(() => {
    const handle = (): void => {
      onLost();
    };
    canvas.addEventListener("webglcontextlost", handle);
    return () => {
      canvas.removeEventListener("webglcontextlost", handle);
    };
  }, [canvas, onLost]);

  return null;
}
