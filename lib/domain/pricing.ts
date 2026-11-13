/**
 * Pricing. The server is the only thing that runs this.
 *
 * Frame base, plus a price per cell in the grid, plus a price per module by
 * type, all multiplied by the finish. Integer pence throughout, and the finish
 * multiplier is applied once to the subtotal rather than per line, so there is
 * exactly one rounding step in the whole calculation.
 *
 * `priceConfiguration` assumes a configuration that has already passed
 * `validateConfiguration`. It is not the guard; the resolver validates first
 * and never reaches this function with an illegal unit.
 */
import {
  CURRENCY,
  FINISH_SPECS,
  FRAME_BASE_CENTS,
  MODULES,
  PER_CELL_CENTS,
} from "@/lib/domain/catalogue";
import type { Configuration, ModuleType } from "@/lib/domain/grid";

export type PriceLine = {
  readonly label: string;
  readonly quantity: number;
  readonly unitCents: number;
  readonly totalCents: number;
};

export type Price = {
  readonly currency: typeof CURRENCY;
  readonly lines: readonly PriceLine[];
  /** Before the finish multiplier. */
  readonly subtotalCents: number;
  readonly finishMultiplierBasisPoints: number;
  readonly totalCents: number;
};

function moduleCounts(
  configuration: Configuration,
): ReadonlyMap<ModuleType, number> {
  const counts = new Map<ModuleType, number>();
  for (const placed of configuration.modules) {
    counts.set(placed.type, (counts.get(placed.type) ?? 0) + 1);
  }
  return counts;
}

export function priceConfiguration(configuration: Configuration): Price {
  const cells = configuration.width * configuration.height;

  const lines: PriceLine[] = [
    {
      label: "Frame",
      quantity: 1,
      unitCents: FRAME_BASE_CENTS,
      totalCents: FRAME_BASE_CENTS,
    },
    {
      label: `Bays (${configuration.width} × ${configuration.height})`,
      quantity: cells,
      unitCents: PER_CELL_CENTS,
      totalCents: cells * PER_CELL_CENTS,
    },
  ];

  const counts = moduleCounts(configuration);
  // Iterating the catalogue rather than the map keeps the order of the lines
  // stable and independent of the order modules were placed in.
  for (const spec of Object.values(MODULES)) {
    const quantity = counts.get(spec.type) ?? 0;
    if (quantity === 0) {
      continue;
    }
    lines.push({
      label: spec.label,
      quantity,
      unitCents: spec.priceCents,
      totalCents: quantity * spec.priceCents,
    });
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
  const { multiplierBasisPoints } = FINISH_SPECS[configuration.finish];
  // One rounding step, half-up, on the only division in the calculation.
  const totalCents = Math.round((subtotalCents * multiplierBasisPoints) / 10_000);

  return {
    currency: CURRENCY,
    lines,
    subtotalCents,
    finishMultiplierBasisPoints: multiplierBasisPoints,
    totalCents,
  };
}
