"use client";

/**
 * Size and finish. Native radio groups, not bespoke widgets: they arrive
 * keyboard-operable, arrow-key navigable within the group, and announced
 * correctly, and nothing here needs behaviour a native control lacks.
 *
 * The input is invisible rather than hidden — it covers its label at full size
 * with `opacity-0` instead of being clipped to a pixel. Clipping it put the
 * control out of reach of anything that drives the page by pointing at
 * elements, which is both the browser tests and some assistive tooling. The
 * styling lives on the sibling, keyed off `peer-checked` and
 * `peer-focus-visible`, so focus and selection are visible without a custom
 * control.
 */
import type { Catalogue } from "@/lib/graphql/generated/types";
import type { Configuration, Finish } from "@/lib/domain/grid";

type ControlsProps = {
  readonly configuration: Configuration;
  readonly catalogue: Catalogue;
  readonly onSetWidth: (width: number) => void;
  readonly onSetHeight: (height: number) => void;
  readonly onSetFinish: (finish: Finish) => void;
};

function range(from: number, to: number): readonly number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

export function Controls({
  configuration,
  catalogue,
  onSetWidth,
  onSetHeight,
  onSetFinish,
}: ControlsProps): React.ReactElement {
  const { limits } = catalogue;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <fieldset>
        <legend className="text-sm font-medium">Columns</legend>
        <p className="mt-1 text-xs text-ink-muted">
          Over {limits.maxWidthWithoutSupport} columns, the middle bay of the
          bottom row holds a centre support.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {range(limits.minWidth, limits.maxWidth).map((width) => (
            <label key={width} className="relative block cursor-pointer">
              <input
                type="radio"
                name="columns"
                value={width}
                checked={configuration.width === width}
                onChange={() => {
                  onSetWidth(width);
                }}
                className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <span className="inline-block rounded-md border border-line px-3 py-1.5 text-sm peer-checked:border-ink peer-checked:bg-ink peer-checked:text-page peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--dowel-focus)]">
                {width}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Rows</legend>
        <p className="mt-1 text-xs text-ink-muted">
          A drawer cannot go in the top row.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {range(limits.minHeight, limits.maxHeight).map((height) => (
            <label key={height} className="relative block cursor-pointer">
              <input
                type="radio"
                name="rows"
                value={height}
                checked={configuration.height === height}
                onChange={() => {
                  onSetHeight(height);
                }}
                className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <span className="inline-block rounded-md border border-line px-3 py-1.5 text-sm peer-checked:border-ink peer-checked:bg-ink peer-checked:text-page peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--dowel-focus)]">
                {height}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium">Finish</legend>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
          {catalogue.finishes.map((finish) => (
            <label key={finish.finish} className="relative block cursor-pointer">
              <input
                type="radio"
                name="finish"
                value={finish.finish}
                checked={configuration.finish === finish.finish}
                onChange={() => {
                  onSetFinish(finish.finish);
                }}
                className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <span className="block h-full rounded-md border border-line px-3 py-2 text-sm peer-checked:border-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--dowel-focus)]">
                <span className="font-medium">{finish.label}</span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  {finish.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
