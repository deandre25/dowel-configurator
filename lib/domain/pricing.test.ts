import { describe, expect, it } from "vitest";
import {
  FINISH_SPECS,
  FRAME_BASE_CENTS,
  LIMITS,
  MODULES,
  PER_CELL_CENTS,
} from "@/lib/domain/catalogue";
import {
  centreSupportColumn,
  type Configuration,
  type Finish,
  type ModuleType,
  type PlacedModule,
} from "@/lib/domain/grid";
import { priceConfiguration } from "@/lib/domain/pricing";
import { validateConfiguration } from "@/lib/domain/rules";

/**
 * Builds a legal unit of the given size filled with the given module counts.
 * The table below prices real configurations, not arbitrary numbers, so each
 * case is asserted to be valid before it is priced.
 */
function fill(
  width: number,
  height: number,
  finish: Finish,
  counts: Partial<Record<ModuleType, number>>,
): Configuration {
  const reserved = centreSupportColumn(width);
  const needsSupport = width > LIMITS.maxWidthWithoutSupport;
  const free: { column: number; row: number }[] = [];
  for (let column = 0; column < width; column += 1) {
    for (let row = 0; row < height; row += 1) {
      if (needsSupport && row === 0 && column === reserved) {
        continue;
      }
      free.push({ column, row });
    }
  }

  const modules: PlacedModule[] = [];
  const taken = new Set<string>();
  const place = (type: ModuleType, quantity: number): void => {
    let placed = 0;
    for (const cell of free) {
      if (placed === quantity) {
        return;
      }
      const footprint =
        type === "DOOR"
          ? [cell, { column: cell.column, row: cell.row + 1 }]
          : [cell];
      const legal = footprint.every(
        (c) =>
          c.row <= height - 1 &&
          !taken.has(`${c.column},${c.row}`) &&
          !(type === "DRAWER" && c.row === height - 1),
      );
      if (!legal) {
        continue;
      }
      for (const c of footprint) {
        taken.add(`${c.column},${c.row}`);
      }
      modules.push({ type, column: cell.column, row: cell.row });
      placed += 1;
    }
    if (placed !== quantity) {
      throw new Error(
        `Could not place ${quantity} × ${type} in a ${width}×${height} unit`,
      );
    }
  };

  // Doors first: they need two free cells, so they are the hardest to place.
  place("DOOR", counts.DOOR ?? 0);
  place("DRAWER", counts.DRAWER ?? 0);
  place("SHELF", counts.SHELF ?? 0);

  return { width, height, finish, modules };
}

type Case = {
  readonly width: number;
  readonly height: number;
  readonly finish: Finish;
  readonly counts: Partial<Record<ModuleType, number>>;
  readonly subtotalCents: number;
  readonly totalCents: number;
  readonly note?: string;
};

/**
 * Known configurations with their prices worked out independently of the
 * implementation — frame 17950, 2175 per cell, 1395/4795/5595 per module,
 * ×1.00 / ×1.08 / ×1.05 by finish.
 */
const TABLE: readonly Case[] = [
  {
    width: 2,
    height: 2,
    finish: "OAK",
    counts: { SHELF: 1 },
    subtotalCents: 28_045,
    totalCents: 28_045,
    note: "the smallest legal unit; oak is ×1 so the total is the subtotal",
  },
  {
    width: 2,
    height: 2,
    finish: "CHARCOAL",
    counts: { SHELF: 1 },
    subtotalCents: 28_045,
    totalCents: 30_289,
    note: "28045 × 1.08 = 30288.6, rounded up",
  },
  {
    width: 2,
    height: 2,
    finish: "WHITE",
    counts: { SHELF: 1 },
    subtotalCents: 28_045,
    totalCents: 29_447,
    note: "28045 × 1.05 = 29447.25, rounded down",
  },
  {
    width: 3,
    height: 3,
    finish: "WHITE",
    counts: { DRAWER: 2, DOOR: 1 },
    subtotalCents: 52_710,
    totalCents: 55_346,
    note: "52710 × 1.05 = 55345.5 exactly — the half-way case, rounded up",
  },
  {
    width: 4,
    height: 2,
    finish: "OAK",
    counts: { DOOR: 4 },
    subtotalCents: 57_730,
    totalCents: 57_730,
    note: "every column a door, no support needed at four columns",
  },
  {
    width: 2,
    height: 5,
    finish: "CHARCOAL",
    counts: { SHELF: 10 },
    subtotalCents: 53_650,
    totalCents: 57_942,
  },
  {
    width: 6,
    height: 5,
    finish: "CHARCOAL",
    counts: { SHELF: 6, DRAWER: 23 },
    subtotalCents: 201_855,
    totalCents: 218_003,
    note: "the largest unit, every cell filled except the support's",
  },
];

describe("priceConfiguration, against a table of known configurations", () => {
  for (const testCase of TABLE) {
    const { width, height, finish, counts, note } = testCase;
    const described = Object.entries(counts)
      .map(([type, n]) => `${String(n)} × ${type}`)
      .join(", ");
    it(`${width}×${height} ${finish}, ${described}${note === undefined ? "" : ` — ${note}`}`, () => {
      const configuration = fill(width, height, finish, counts);
      // A price for an illegal unit would be meaningless, so the case is
      // checked against the rules before it is priced.
      expect(validateConfiguration(configuration)).toEqual({ valid: true });

      const price = priceConfiguration(configuration);
      expect(price.subtotalCents).toBe(testCase.subtotalCents);
      expect(price.totalCents).toBe(testCase.totalCents);
      expect(price.currency).toBe("GBP");
      expect(price.finishMultiplierBasisPoints).toBe(
        FINISH_SPECS[finish].multiplierBasisPoints,
      );
    });
  }
});

describe("the composition of a price", () => {
  it("adds up to the subtotal, line by line", () => {
    const configuration = fill(4, 3, "OAK", { SHELF: 2, DRAWER: 2, DOOR: 1 });
    const price = priceConfiguration(configuration);
    const summed = price.lines.reduce((total, line) => total + line.totalCents, 0);
    expect(summed).toBe(price.subtotalCents);
  });

  it("charges the frame once and the cells by area, including a cell a support would take", () => {
    const configuration = fill(5, 3, "OAK", { SHELF: 1 });
    const price = priceConfiguration(configuration);
    expect(price.lines[0]).toEqual({
      label: "Frame",
      quantity: 1,
      unitCents: FRAME_BASE_CENTS,
      totalCents: FRAME_BASE_CENTS,
    });
    expect(price.lines[1]).toMatchObject({
      quantity: 15,
      unitCents: PER_CELL_CENTS,
      totalCents: 15 * PER_CELL_CENTS,
    });
  });

  it("prices each module type at its catalogue price", () => {
    const configuration = fill(4, 3, "OAK", { SHELF: 3, DRAWER: 2, DOOR: 1 });
    const price = priceConfiguration(configuration);
    for (const spec of Object.values(MODULES)) {
      const line = price.lines.find((l) => l.label === spec.label);
      expect(line?.unitCents).toBe(spec.priceCents);
    }
    expect(price.lines.find((l) => l.label === MODULES.SHELF.label)?.quantity).toBe(3);
  });

  it("omits a line for a module type that is not used", () => {
    const configuration = fill(3, 3, "OAK", { SHELF: 1 });
    const price = priceConfiguration(configuration);
    expect(price.lines.map((l) => l.label)).not.toContain(MODULES.DOOR.label);
  });

  it("orders lines the same way whatever order modules were placed in", () => {
    const base = fill(4, 3, "OAK", { SHELF: 2, DRAWER: 1, DOOR: 1 });
    const reversed: Configuration = {
      ...base,
      modules: [...base.modules].reverse(),
    };
    expect(priceConfiguration(reversed).lines).toEqual(
      priceConfiguration(base).lines,
    );
    expect(priceConfiguration(reversed).totalCents).toBe(
      priceConfiguration(base).totalCents,
    );
  });

  it("applies the finish once to the subtotal, across every unit size and finish", () => {
    // The contract is the formula, asserted everywhere rather than on one
    // configuration that might agree with a per-line calculation by accident.
    for (const finish of ["OAK", "CHARCOAL", "WHITE"] as const) {
      const basisPoints = FINISH_SPECS[finish].multiplierBasisPoints;
      for (let width = LIMITS.minWidth; width <= LIMITS.maxWidth; width += 1) {
        for (
          let height = LIMITS.minHeight;
          height <= LIMITS.maxHeight;
          height += 1
        ) {
          const configuration = fill(width, height, finish, {
            SHELF: 1,
            DRAWER: height > 2 ? 1 : 0,
          });
          const price = priceConfiguration(configuration);
          expect(price.totalCents).toBe(
            Math.round((price.subtotalCents * basisPoints) / 10_000),
          );
        }
      }
    }
  });

  it("rounds once, so a per-line multiplier would disagree somewhere", () => {
    // Rather than assert a difference on one configuration — where the two
    // methods can agree by coincidence — find whether any unit distinguishes
    // them. If none did, this test would be vacuous and should be deleted.
    const disagreements: string[] = [];
    for (const finish of ["CHARCOAL", "WHITE"] as const) {
      const basisPoints = FINISH_SPECS[finish].multiplierBasisPoints;
      for (let width = LIMITS.minWidth; width <= LIMITS.maxWidth; width += 1) {
        for (
          let height = LIMITS.minHeight;
          height <= LIMITS.maxHeight;
          height += 1
        ) {
          const price = priceConfiguration(
            fill(width, height, finish, { SHELF: 1, DOOR: 1 }),
          );
          const perLine = price.lines.reduce(
            (total, line) =>
              total + Math.round((line.totalCents * basisPoints) / 10_000),
            0,
          );
          if (perLine !== price.totalCents) {
            disagreements.push(`${width}×${height} ${finish}`);
          }
        }
      }
    }
    expect(disagreements.length).toBeGreaterThan(0);
  });

  it("returns whole pence", () => {
    for (const finish of ["OAK", "CHARCOAL", "WHITE"] as const) {
      for (let width = LIMITS.minWidth; width <= LIMITS.maxWidth; width += 1) {
        const configuration = fill(width, 3, finish, { SHELF: 1 });
        const price = priceConfiguration(configuration);
        expect(Number.isInteger(price.totalCents)).toBe(true);
        expect(Number.isInteger(price.subtotalCents)).toBe(true);
      }
    }
  });
});
