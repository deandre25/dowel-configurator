/**
 * The compatibility rules. One module, imported by the resolver that prices a
 * configuration, by the resolver that saves one, and by the tests.
 *
 * The client may import this too, for feedback that does not wait for a round
 * trip. The server never trusts the result: a mutation carrying an impossible
 * configuration is rejected here, inside the resolver, whatever the interface
 * believed.
 *
 * A violation names the cells it is about, so the interface can render it next
 * to the offending cell rather than as a sentence at the top of the page.
 */
import { LIMITS } from "@/lib/domain/catalogue";
import {
  cellKey,
  cellsOccupiedBy,
  centreSupportCell,
  sameCell,
  type Cell,
  type Configuration,
  type PlacedModule,
} from "@/lib/domain/grid";

export const RULE_CODES = [
  "DIMENSIONS_OUT_OF_RANGE",
  "TOO_MANY_MODULES",
  "EMPTY_UNIT",
  "OUT_OF_BOUNDS",
  "DRAWER_IN_TOP_ROW",
  "DOOR_SPANS_TOP_EDGE",
  "CELL_OCCUPIED",
  "CELL_RESERVED_FOR_SUPPORT",
] as const;

export type RuleCode = (typeof RULE_CODES)[number];

export type Violation = {
  readonly code: RuleCode;
  /** Written for a person, in the interface's voice. */
  readonly message: string;
  /** The cells this violation is about. Empty when it is about the unit. */
  readonly cells: readonly Cell[];
  /** Index into `configuration.modules`, or null when no single module is at fault. */
  readonly moduleIndex: number | null;
};

export type ValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly violations: readonly Violation[] };

/**
 * The most modules any legal unit can hold: one per bay of the largest grid.
 * An input carrying more than this is rejected before anything iterates over
 * it, which keeps a hostile request from costing work proportional to whatever
 * it chose to send.
 */
export const MAX_MODULES = LIMITS.maxWidth * LIMITS.maxHeight;

function topRow(configuration: Configuration): number {
  return configuration.height - 1;
}

function isWholeNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function dimensionViolations(
  configuration: Configuration,
): readonly Violation[] {
  const violations: Violation[] = [];
  const { width, height } = configuration;

  if (
    !Number.isInteger(width) ||
    width < LIMITS.minWidth ||
    width > LIMITS.maxWidth
  ) {
    violations.push({
      code: "DIMENSIONS_OUT_OF_RANGE",
      message: `A unit is between ${LIMITS.minWidth} and ${LIMITS.maxWidth} columns wide.`,
      cells: [],
      moduleIndex: null,
    });
  }

  if (
    !Number.isInteger(height) ||
    height < LIMITS.minHeight ||
    height > LIMITS.maxHeight
  ) {
    violations.push({
      code: "DIMENSIONS_OUT_OF_RANGE",
      message: `A unit is between ${LIMITS.minHeight} and ${LIMITS.maxHeight} rows tall.`,
      cells: [],
      moduleIndex: null,
    });
  }

  return violations;
}

function placementViolations(
  configuration: Configuration,
  placed: PlacedModule,
  index: number,
): readonly Violation[] {
  const violations: Violation[] = [];
  const cells = cellsOccupiedBy(placed);
  const anchor: Cell = { column: placed.column, row: placed.row };

  const overflowsTop = cells.some((cell) => cell.row > topRow(configuration));
  const outsideOtherwise = cells.some(
    (cell) =>
      !isWholeNumber(cell.column) ||
      !isWholeNumber(cell.row) ||
      cell.column > configuration.width - 1 ||
      (cell.row > topRow(configuration) && placed.type !== "DOOR"),
  );

  if (placed.type === "DOOR" && overflowsTop) {
    violations.push({
      code: "DOOR_SPANS_TOP_EDGE",
      message:
        "A door covers two bays, one above the other, so it cannot start in the top row.",
      cells: [anchor],
      moduleIndex: index,
    });
  }

  if (outsideOtherwise) {
    violations.push({
      code: "OUT_OF_BOUNDS",
      message: "That module is outside the unit.",
      cells: [anchor],
      moduleIndex: index,
    });
  }

  if (placed.type === "DRAWER" && placed.row === topRow(configuration)) {
    violations.push({
      code: "DRAWER_IN_TOP_ROW",
      message: "A drawer cannot go in the top row — you would be reaching over it.",
      cells: [anchor],
      moduleIndex: index,
    });
  }

  return violations;
}

function overlapViolations(configuration: Configuration): readonly Violation[] {
  const violations: Violation[] = [];
  const claimedBy = new Map<string, number>();

  configuration.modules.forEach((placed, index) => {
    for (const cell of cellsOccupiedBy(placed)) {
      const key = cellKey(cell);
      const existing = claimedBy.get(key);
      if (existing === undefined) {
        claimedBy.set(key, index);
        continue;
      }
      violations.push({
        code: "CELL_OCCUPIED",
        message: "That bay is already taken.",
        cells: [cell],
        moduleIndex: index,
      });
    }
  });

  return violations;
}

function supportViolations(configuration: Configuration): readonly Violation[] {
  if (configuration.width <= LIMITS.maxWidthWithoutSupport) {
    return [];
  }

  const reserved = centreSupportCell(configuration.width);
  const violations: Violation[] = [];

  configuration.modules.forEach((placed, index) => {
    const clashes = cellsOccupiedBy(placed).some((cell) =>
      sameCell(cell, reserved),
    );
    if (clashes) {
      violations.push({
        code: "CELL_RESERVED_FOR_SUPPORT",
        message: `A unit over ${LIMITS.maxWidthWithoutSupport} columns wide needs a centre support, which stands in this bay.`,
        cells: [reserved],
        moduleIndex: index,
      });
    }
  });

  return violations;
}

/**
 * Validates a configuration and returns every rule it breaks, not only the
 * first — an interface that reports one problem at a time makes the visitor
 * find the rest by trial.
 *
 * Dimensions are the exception: when the grid itself is out of range, every
 * cell-level answer would be relative to a unit that cannot exist, so those
 * violations are returned alone.
 */
export function validateConfiguration(
  configuration: Configuration,
): ValidationResult {
  const dimensions = dimensionViolations(configuration);
  if (dimensions.length > 0) {
    return { valid: false, violations: dimensions };
  }

  if (configuration.modules.length > MAX_MODULES) {
    return {
      valid: false,
      violations: [
        {
          code: "TOO_MANY_MODULES",
          message: `A unit holds at most ${MAX_MODULES} modules, one for each bay of the largest size.`,
          cells: [],
          moduleIndex: null,
        },
      ],
    };
  }

  const violations: Violation[] = [];

  if (configuration.modules.length === 0) {
    violations.push({
      code: "EMPTY_UNIT",
      message: "A unit needs at least one shelf, drawer or door.",
      cells: [],
      moduleIndex: null,
    });
  }

  configuration.modules.forEach((placed, index) => {
    violations.push(...placementViolations(configuration, placed, index));
  });

  violations.push(...overlapViolations(configuration));
  violations.push(...supportViolations(configuration));

  if (violations.length === 0) {
    return { valid: true };
  }
  return { valid: false, violations };
}
