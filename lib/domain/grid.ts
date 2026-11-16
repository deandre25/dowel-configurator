/**
 * The grid, and the vocabulary everything else in the domain uses.
 *
 * Coordinates: `column` counts from the left, `row` counts from the **bottom**,
 * both zero-based. Row 0 is the row that stands on the floor, row
 * `height - 1` is the top row. A shelving unit is built upwards from the
 * ground, the compatibility rules are written in terms of the top row and the
 * bottom row, and a door that "spans the top edge" only means anything if up
 * is positive. The accessible control surface renders rows in the opposite
 * order, top first, because that is how a table reads; that is presentation
 * and it does not reach this module.
 */

export const MODULE_TYPES = ["SHELF", "DRAWER", "DOOR"] as const;
export type ModuleType = (typeof MODULE_TYPES)[number];

export const FINISHES = ["OAK", "CHARCOAL", "WHITE"] as const;
export type Finish = (typeof FINISHES)[number];

export type Cell = {
  readonly column: number;
  readonly row: number;
};

/**
 * A module placed on the grid. `column` and `row` are its anchor: for a door,
 * the lower of its two cells. Nothing else in the domain needs to know how a
 * module is anchored, because `cellsOccupiedBy` answers that question.
 */
export type PlacedModule = {
  readonly type: ModuleType;
  readonly column: number;
  readonly row: number;
};

export type Configuration = {
  readonly width: number;
  readonly height: number;
  readonly finish: Finish;
  readonly modules: readonly PlacedModule[];
};

/** How many cells a module type covers, and in which direction. */
export const MODULE_FOOTPRINT: Readonly<Record<ModuleType, number>> = {
  SHELF: 1,
  DRAWER: 1,
  DOOR: 2,
};

/** The cells a placed module covers, anchor included. */
export function cellsOccupiedBy(placed: PlacedModule): readonly Cell[] {
  const height = MODULE_FOOTPRINT[placed.type];
  const cells: Cell[] = [];
  for (let offset = 0; offset < height; offset += 1) {
    cells.push({ column: placed.column, row: placed.row + offset });
  }
  return cells;
}

/**
 * The column a centre support stands in, for units that need one.
 *
 * For an odd width this is the true middle. For an even width there is no
 * middle, so the right-hand one of the two central columns is chosen —
 * arbitrary, but fixed, documented, and the same everywhere because only this
 * function knows it.
 */
export function centreSupportColumn(width: number): number {
  return Math.floor(width / 2);
}

/** The cell a centre support consumes: the centre column of the bottom row. */
export function centreSupportCell(width: number): Cell {
  return { column: centreSupportColumn(width), row: 0 };
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.column === b.column && a.row === b.row;
}

export function cellKey(cell: Cell): string {
  return `${cell.column},${cell.row}`;
}
