/**
 * Every number the product is priced from, in one place, as data.
 *
 * The server is the only thing that reads this file. It is not exported to the
 * client as literals and it is not duplicated in the interface: the client
 * learns prices by asking `Query.catalogue`, and learns the price of a
 * configuration by asking the server to price it.
 *
 * Money is in integer minor units — pence — throughout. A finish multiplier is
 * in basis points, so the arithmetic stays in integers and rounds exactly once,
 * at the end, rather than accumulating a float error per module.
 */
import {
  FINISHES,
  MODULE_TYPES,
  type Finish,
  type ModuleType,
} from "@/lib/domain/grid";

export const CURRENCY = "GBP" as const;

export type Limits = {
  readonly minWidth: number;
  readonly maxWidth: number;
  readonly minHeight: number;
  readonly maxHeight: number;
  /** A unit wider than this needs a centre support. */
  readonly maxWidthWithoutSupport: number;
};

export const LIMITS: Limits = {
  minWidth: 2,
  maxWidth: 6,
  minHeight: 2,
  maxHeight: 5,
  maxWidthWithoutSupport: 4,
};

export type ModuleSpec = {
  readonly type: ModuleType;
  readonly label: string;
  readonly description: string;
  /** Cells covered, counting upwards from the anchor. */
  readonly cells: number;
  readonly priceCents: number;
};

export const MODULES: Readonly<Record<ModuleType, ModuleSpec>> = {
  SHELF: {
    type: "SHELF",
    label: "Open shelf",
    description: "An open bay. Holds books upright or baskets flat.",
    cells: 1,
    priceCents: 1_395,
  },
  DRAWER: {
    type: "DRAWER",
    label: "Drawer",
    description:
      "A soft-close drawer on side runners. Not available in the top row.",
    cells: 1,
    priceCents: 4_795,
  },
  DOOR: {
    type: "DOOR",
    label: "Door",
    description:
      "A hinged door over two bays, one above the other. Closes flush with the frame.",
    cells: 2,
    priceCents: 5_595,
  },
};

export type FinishSpec = {
  readonly finish: Finish;
  readonly label: string;
  readonly description: string;
  /** 10_000 is ×1. */
  readonly multiplierBasisPoints: number;
};

export const FINISH_SPECS: Readonly<Record<Finish, FinishSpec>> = {
  OAK: {
    finish: "OAK",
    label: "Oak",
    description: "Solid oak, oiled. The grain shows and darkens with light.",
    multiplierBasisPoints: 10_000,
  },
  CHARCOAL: {
    finish: "CHARCOAL",
    label: "Charcoal",
    description: "Powder-coated steel frame with charcoal birch ply panels.",
    multiplierBasisPoints: 10_800,
  },
  WHITE: {
    finish: "WHITE",
    label: "White",
    description: "Powder-coated steel frame with white birch ply panels.",
    multiplierBasisPoints: 10_500,
  },
};

/** Priced once per unit, whatever it holds. */
export const FRAME_BASE_CENTS = 17_950;

/**
 * Priced per cell in the grid, whether or not a module sits in it — the frame
 * is built for the full grid either way, including the cell a centre support
 * consumes.
 */
export const PER_CELL_CENTS = 2_175;

export const CATALOGUE = {
  currency: CURRENCY,
  limits: LIMITS,
  modules: MODULE_TYPES.map((type) => MODULES[type]),
  finishes: FINISHES.map((finish) => FINISH_SPECS[finish]),
  frameBaseCents: FRAME_BASE_CENTS,
  perCellCents: PER_CELL_CENTS,
} as const;
