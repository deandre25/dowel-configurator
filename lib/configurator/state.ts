/**
 * The configurator's state, as a pure reducer.
 *
 * Everything the visitor can do to a unit is a function from one configuration
 * to another, with no React and no network in it, so all of it is testable
 * directly. The component holds the result; it does not hold the rules.
 *
 * **This is not the authority.** Every change is sent to the server to be
 * validated and priced, and the server's answer is what the interface shows.
 * What this does is keep the client from constructing obvious nonsense — a
 * module left outside the grid after the unit is made smaller, two modules in
 * one bay — so that the common case is a legal configuration and the server's
 * rejection is reserved for the interesting ones.
 */
import { LIMITS } from "@/lib/domain/catalogue";
import {
  cellKey,
  cellsOccupiedBy,
  centreSupportCell,
  sameCell,
  type Cell,
  type Configuration,
  type Finish,
  type ModuleType,
  type PlacedModule,
} from "@/lib/domain/grid";

export type Action =
  | { readonly type: "setWidth"; readonly width: number }
  | { readonly type: "setHeight"; readonly height: number }
  | { readonly type: "setFinish"; readonly finish: Finish }
  | {
      readonly type: "setCell";
      readonly cell: Cell;
      /** null empties the bay. */
      readonly module: ModuleType | null;
    }
  | { readonly type: "restore"; readonly configuration: Configuration };

/** What occupies a bay, if anything. */
export type Occupancy = {
  readonly module: PlacedModule;
  readonly index: number;
  /** False for the upper half of a door. */
  readonly isAnchor: boolean;
};

export function occupancy(
  configuration: Configuration,
): ReadonlyMap<string, Occupancy> {
  const map = new Map<string, Occupancy>();
  configuration.modules.forEach((module, index) => {
    cellsOccupiedBy(module).forEach((cell, offset) => {
      map.set(cellKey(cell), { module, index, isAnchor: offset === 0 });
    });
  });
  return map;
}

export function moduleAt(
  configuration: Configuration,
  cell: Cell,
): Occupancy | null {
  return occupancy(configuration).get(cellKey(cell)) ?? null;
}

/** The bay a centre support stands in, or null when the unit is narrow. */
export function reservedCell(width: number): Cell | null {
  return width > LIMITS.maxWidthWithoutSupport ? centreSupportCell(width) : null;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function withinGrid(
  module: PlacedModule,
  width: number,
  height: number,
): boolean {
  return cellsOccupiedBy(module).every(
    (cell) =>
      cell.column >= 0 &&
      cell.column < width &&
      cell.row >= 0 &&
      cell.row < height,
  );
}

/**
 * Drops modules a change of size has made impossible: outside the grid, a
 * drawer now in the top row, or standing where a centre support now goes.
 *
 * They are dropped rather than kept-and-rejected because the visitor made the
 * unit smaller, which is not an error, and a form that refuses to shrink until
 * you empty it first is a worse answer than removing what no longer fits.
 */
function fitToGrid(
  modules: readonly PlacedModule[],
  width: number,
  height: number,
): readonly PlacedModule[] {
  const reserved = reservedCell(width);
  return modules.filter((module) => {
    if (!withinGrid(module, width, height)) {
      return false;
    }
    if (module.type === "DRAWER" && module.row === height - 1) {
      return false;
    }
    if (
      reserved !== null &&
      cellsOccupiedBy(module).some((cell) => sameCell(cell, reserved))
    ) {
      return false;
    }
    return true;
  });
}

/** Removes whatever covers these cells, module and all. */
function clearCells(
  modules: readonly PlacedModule[],
  cells: readonly Cell[],
): readonly PlacedModule[] {
  return modules.filter(
    (module) =>
      !cellsOccupiedBy(module).some((occupied) =>
        cells.some((cell) => sameCell(cell, occupied)),
      ),
  );
}

function setCell(
  configuration: Configuration,
  cell: Cell,
  type: ModuleType | null,
): Configuration {
  const candidate: PlacedModule | null =
    type === null ? null : { type, column: cell.column, row: cell.row };

  // A door needs its upper bay too, so whatever is there goes as well.
  const affected =
    candidate === null ? [cell] : [...cellsOccupiedBy(candidate)];
  const remaining = clearCells(configuration.modules, affected);

  if (candidate === null) {
    return { ...configuration, modules: remaining };
  }
  return { ...configuration, modules: [...remaining, candidate] };
}

export function reduce(
  configuration: Configuration,
  action: Action,
): Configuration {
  switch (action.type) {
    case "setWidth": {
      const width = clamp(action.width, LIMITS.minWidth, LIMITS.maxWidth);
      return {
        ...configuration,
        width,
        modules: fitToGrid(configuration.modules, width, configuration.height),
      };
    }
    case "setHeight": {
      const height = clamp(action.height, LIMITS.minHeight, LIMITS.maxHeight);
      return {
        ...configuration,
        height,
        modules: fitToGrid(configuration.modules, configuration.width, height),
      };
    }
    case "setFinish":
      return { ...configuration, finish: action.finish };
    case "setCell":
      return setCell(configuration, action.cell, action.module);
    case "restore":
      return action.configuration;
  }
}

/** What the API's `ConfigurationInput` wants. */
export function toInput(configuration: Configuration): {
  width: number;
  height: number;
  finish: Finish;
  modules: { type: ModuleType; column: number; row: number }[];
} {
  return {
    width: configuration.width,
    height: configuration.height,
    finish: configuration.finish,
    modules: configuration.modules.map((module) => ({
      type: module.type,
      column: module.column,
      row: module.row,
    })),
  };
}

/** The unit a visitor starts with: small, legal, and obviously changeable. */
export const STARTING_CONFIGURATION: Configuration = {
  width: 3,
  height: 3,
  finish: "OAK",
  modules: [
    { type: "DRAWER", column: 0, row: 0 },
    { type: "SHELF", column: 1, row: 1 },
    { type: "DOOR", column: 2, row: 0 },
  ],
};
