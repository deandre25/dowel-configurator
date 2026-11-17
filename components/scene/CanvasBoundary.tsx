"use client";

/**
 * Keeps a failing canvas from taking the configurator with it.
 *
 * Without this, a browser that cannot create a WebGL context loses the entire
 * interface: no bays, no controls, no price — verified against the deployed
 * site by launching Chromium with WebGL disabled, which produced zero bay
 * controls and one console error. That is the exact opposite of what this
 * project claims, which is that the canvas is a view of the controls rather
 * than the way in.
 *
 * WebGL is unavailable more often than it looks from a developer's machine:
 * old hardware, a driver on the browser's blocklist, enterprise policy,
 * privacy extensions, and a GPU process that has crashed once too often in the
 * current session.
 *
 * It has to be a class component. Error boundaries have no hook equivalent.
 */
import { Component, type ReactNode } from "react";

type BoundaryProps = {
  readonly children: ReactNode;
  /** Describes the unit in words, which is what the canvas was showing. */
  readonly description: string;
};

type BoundaryState = { readonly failed: boolean };

export class CanvasBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <div className="flex h-full flex-col justify-end gap-2 p-4">
        <p className="text-sm text-ink-muted">
          The three-dimensional view cannot run in this browser. Everything
          else works: the unit below is described in words, and the controls
          build and price it exactly the same.
        </p>
        <p className="text-sm">{this.props.description}</p>
      </div>
    );
  }
}
