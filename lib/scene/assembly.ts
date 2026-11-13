/**
 * Turns a configuration into a flat list of parts.
 *
 * This is where the unit is designed: every panel, board, front and pull, with
 * a position and a size, computed from the configuration and the dimensions in
 * `dimensions.ts`. It is a pure function of the configuration, which means the
 * assembly can be tested exhaustively without a renderer — and it means the
 * renderer's only job is to put each part's transform into an instance matrix.
 *
 * Each part carries a stable `key`. The key is what makes an animated change
 * possible: between one configuration and the next, a part with the same key
 * is the same part and moves, a key that appears is a part that grows in, and a
 * key that goes is a part that shrinks out. Nothing is rebuilt.
 */
import { LIMITS } from "@/lib/domain/catalogue";
import {
  centreSupportColumn,
  type Configuration,
  type PlacedModule,
} from "@/lib/domain/grid";
import { MAX_MODULES } from "@/lib/domain/rules";
import { DIMENSIONS, bayCentre, unitSize } from "@/lib/scene/dimensions";

export const PART_TYPES = [
  "upright",
  "board",
  "back",
  "support",
  "drawerFront",
  "drawerPull",
  "doorPanel",
  "doorPull",
] as const;

export type PartType = (typeof PART_TYPES)[number];

/** Which primitive a part type is drawn from. */
export const PART_SHAPE: Readonly<Record<PartType, "box" | "rod">> = {
  upright: "box",
  board: "box",
  back: "box",
  support: "box",
  drawerFront: "box",
  drawerPull: "rod",
  doorPanel: "box",
  doorPull: "rod",
};

export type Part = {
  readonly key: string;
  readonly type: PartType;
  readonly position: readonly [number, number, number];
  /** Scale applied to the unit primitive, so this is the part's size. */
  readonly scale: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
};

/**
 * How many instances of each part type can be needed. The instanced meshes are
 * allocated once at these counts and never reallocated, so changing the
 * configuration writes matrices and nothing else.
 *
 * The module counts are the module ceiling the rules enforce — one per bay of
 * the largest grid — and not the smaller number a *legal* unit can reach. A
 * door covers two bays, so no valid configuration has more than 15 of them;
 * sized to 15, an input the rules would have rejected would overflow the
 * buffer and the renderer would quietly draw the wrong unit. Fifteen spare
 * matrices cost nothing and the failure they prevent is silent.
 */
export const PART_CAPACITY: Readonly<Record<PartType, number>> = {
  upright: LIMITS.maxWidth + 1,
  board: LIMITS.maxHeight + 1,
  back: 1,
  support: 1,
  drawerFront: MAX_MODULES,
  drawerPull: MAX_MODULES,
  doorPanel: MAX_MODULES,
  doorPull: MAX_MODULES,
};

const NO_ROTATION: readonly [number, number, number] = [0, 0, 0];
/** A rod is modelled along Y; a quarter turn about Z lays it flat. */
const QUARTER_TURN_Z: readonly [number, number, number] = [0, 0, Math.PI / 2];

function frameParts(columns: number, rows: number): readonly Part[] {
  const { bayWidth, bayHeight, panelThickness, depth, backThickness } =
    DIMENSIONS;
  const size = unitSize(columns, rows);
  const parts: Part[] = [];

  // Uprights: one at each side of every bay, so columns + 1 of them.
  for (let index = 0; index <= columns; index += 1) {
    parts.push({
      key: `upright:${String(index)}`,
      type: "upright",
      position: [
        -size.width / 2 +
          panelThickness / 2 +
          index * (bayWidth + panelThickness),
        size.height / 2,
        0,
      ],
      scale: [panelThickness, size.height, depth],
      rotation: NO_ROTATION,
    });
  }

  // Boards: one under every row and one on top, so rows + 1.
  for (let index = 0; index <= rows; index += 1) {
    parts.push({
      key: `board:${String(index)}`,
      type: "board",
      position: [
        0,
        panelThickness / 2 + index * (bayHeight + panelThickness),
        0,
      ],
      scale: [size.width, panelThickness, depth],
      rotation: NO_ROTATION,
    });
  }

  parts.push({
    key: "back:0",
    type: "back",
    position: [0, size.height / 2, -depth / 2 + backThickness / 2],
    scale: [size.width, size.height, backThickness],
    rotation: NO_ROTATION,
  });

  if (columns > LIMITS.maxWidthWithoutSupport) {
    const column = centreSupportColumn(columns);
    const centre = bayCentre(columns, rows, column, 0);
    parts.push({
      key: "support:0",
      type: "support",
      position: [centre.x, centre.y, 0],
      scale: [panelThickness, bayHeight, depth],
      rotation: NO_ROTATION,
    });
  }

  return parts;
}

function moduleParts(
  columns: number,
  rows: number,
  placed: PlacedModule,
): readonly Part[] {
  const {
    bayWidth,
    bayHeight,
    panelThickness,
    depth,
    reveal,
    pullRadius,
    pullStandoff,
    drawerPullLength,
    doorPullLength,
    frontInset,
  } = DIMENSIONS;
  const centre = bayCentre(columns, rows, placed.column, placed.row);
  // Set back, so a front's outer face is never coplanar with the frame.
  const faceZ = depth / 2 - panelThickness / 2 - frontInset;
  const at = `${String(placed.column)},${String(placed.row)}`;

  if (placed.type === "SHELF") {
    // An open bay is the absence of a part. The frame already describes it.
    return [];
  }

  if (placed.type === "DRAWER") {
    return [
      {
        key: `drawerFront:${at}`,
        type: "drawerFront",
        position: [centre.x, centre.y, faceZ],
        scale: [bayWidth - reveal, bayHeight - reveal, panelThickness],
        rotation: NO_ROTATION,
      },
      {
        key: `drawerPull:${at}`,
        type: "drawerPull",
        position: [centre.x, centre.y + bayHeight * 0.26, faceZ + pullStandoff],
        scale: [pullRadius * 2, drawerPullLength, pullRadius * 2],
        rotation: QUARTER_TURN_Z,
      },
    ];
  }

  // A door covers this bay and the one above it, and the board between them.
  const doorHeight = bayHeight * 2 + panelThickness - reveal;
  const doorCentreY = centre.y + (bayHeight + panelThickness) / 2;
  return [
    {
      key: `doorPanel:${at}`,
      type: "doorPanel",
      position: [centre.x, doorCentreY, faceZ],
      scale: [bayWidth - reveal, doorHeight, panelThickness],
      rotation: NO_ROTATION,
    },
    {
      key: `doorPull:${at}`,
      // Set in from the opening edge, which is the right-hand side.
      position: [
        centre.x + bayWidth * 0.32,
        doorCentreY,
        faceZ + pullStandoff,
      ],
      type: "doorPull",
      scale: [pullRadius * 2, doorPullLength, pullRadius * 2],
      rotation: NO_ROTATION,
    },
  ];
}

/**
 * Every part of a unit, in a stable order. Assumes a configuration that has
 * passed `validateConfiguration`: the assembly draws what it is given and does
 * not arbitrate legality.
 */
export function assembleUnit(configuration: Configuration): readonly Part[] {
  const { width, height, modules } = configuration;
  return [
    ...frameParts(width, height),
    ...modules.flatMap((placed) => moduleParts(width, height, placed)),
  ];
}

/** The parts of one type, in order. */
export function partsOfType(
  parts: readonly Part[],
  type: PartType,
): readonly Part[] {
  return parts.filter((part) => part.type === type);
}
