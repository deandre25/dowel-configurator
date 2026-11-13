/**
 * The physical dimensions of the product, in metres, in one place.
 *
 * These are the numbers the geometry is generated from. A downloaded model of
 * a finished shelf could not change its own size; this can, which is the whole
 * reason the unit is assembled in code.
 */
export const DIMENSIONS = {
  /** Clear width of one bay. */
  bayWidth: 0.36,
  /** Clear height of one bay. */
  bayHeight: 0.36,
  /** Front to back, outside to outside. */
  depth: 0.32,
  /** Boards and uprights: 18 mm panel. */
  panelThickness: 0.018,
  /** The back is a thinner sheet, set into the frame. */
  backThickness: 0.006,
  /** Gap around a drawer front or door, so it reads as a moving part. */
  reveal: 0.004,
  /**
   * How far a front is set back from the front edge of the frame.
   *
   * Not decoration: without it a front's outer face is exactly coplanar with
   * the board behind it, and the depth buffer cannot separate two surfaces at
   * the same depth — the result was horizontal bands flickering across every
   * door, visible in the first screenshots.
   */
  frontInset: 0.002,
  /** Drawer and door pulls: a 12 mm rod. */
  pullRadius: 0.006,
  /** How far a pull stands off the face it is fixed to. */
  pullStandoff: 0.022,
  /** Length of the horizontal pull on a drawer. */
  drawerPullLength: 0.11,
  /** Length of the vertical pull on a door. */
  doorPullLength: 0.14,
} as const;

/** Outside dimensions of a unit of this many columns and rows. */
export function unitSize(
  columns: number,
  rows: number,
): { width: number; height: number; depth: number } {
  const { bayWidth, bayHeight, panelThickness, depth } = DIMENSIONS;
  return {
    width: columns * bayWidth + (columns + 1) * panelThickness,
    height: rows * bayHeight + (rows + 1) * panelThickness,
    depth,
  };
}

/** Centre of the bay at this column and row, in the unit's own frame. */
export function bayCentre(
  columns: number,
  rows: number,
  column: number,
  row: number,
): { x: number; y: number } {
  const { bayWidth, bayHeight, panelThickness } = DIMENSIONS;
  const { width } = unitSize(columns, rows);
  return {
    x:
      -width / 2 +
      panelThickness +
      column * (bayWidth + panelThickness) +
      bayWidth / 2,
    y: panelThickness + row * (bayHeight + panelThickness) + bayHeight / 2,
  };
}
