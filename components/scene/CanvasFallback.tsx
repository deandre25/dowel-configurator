"use client";

/**
 * What stands in for the canvas when there is no canvas.
 *
 * Two different failures land here and they are worth naming separately,
 * because only one of them announces itself:
 *
 * - **No context at the start.** `WebGLRenderer` throws while mounting, React
 *   catches it in `CanvasBoundary`, and the subtree never renders.
 * - **Context lost mid-session.** The GPU process crashes, the driver resets,
 *   the tab is backgrounded too long, or the browser reclaims the context
 *   under memory pressure. **Nothing is thrown.** A `webglcontextlost` event
 *   fires on the canvas, asynchronously, outside React's render cycle, and an
 *   error boundary never hears about it.
 *
 * The second is the dangerous one. Measured on the deployed site before this
 * existed: the canvas stayed in the document showing its last frame, the
 * configuration went on changing, the price went on updating, and the picture
 * silently stopped matching the unit. A blank canvas is obvious; a stale one
 * is a lie.
 */
type CanvasFallbackProps = {
  readonly description: string;
  readonly reason: "unavailable" | "lost";
};

export function CanvasFallback({
  description,
  reason,
}: CanvasFallbackProps): React.ReactElement {
  return (
    <div className="flex h-full flex-col justify-end gap-2 p-4">
      <p className="text-sm text-ink-muted">
        {reason === "lost"
          ? "The three-dimensional view stopped — the browser dropped its connection to the graphics card. Everything else works, and the unit is described below."
          : "The three-dimensional view cannot run in this browser. Everything else works: the unit below is described in words, and the controls build and price it exactly the same."}
      </p>
      <p className="text-sm">{description}</p>
    </div>
  );
}
