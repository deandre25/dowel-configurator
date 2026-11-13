/**
 * Three example builds.
 *
 * They exist because the scene has to be looked at and measured before there
 * are controls to build anything with, and because these are the three cases
 * worth looking at: the smallest unit, the largest, and one that uses every
 * module type. Each is a legal configuration — the tests assert that against
 * the rules rather than trusting the author.
 */
import { LIMITS } from "@/lib/domain/catalogue";
import {
  centreSupportColumn,
  type Configuration,
  type PlacedModule,
} from "@/lib/domain/grid";

export const EXAMPLE_NAMES = ["minimum", "mixed", "maximum"] as const;
export type ExampleName = (typeof EXAMPLE_NAMES)[number];

function largest(): Configuration {
  const width = LIMITS.maxWidth;
  const height = LIMITS.maxHeight;
  const reserved = centreSupportColumn(width);
  const modules: PlacedModule[] = [];
  for (let column = 0; column < width; column += 1) {
    for (let row = 0; row < height; row += 1) {
      if (row === 0 && column === reserved) {
        continue;
      }
      // Drawers wherever they are allowed, shelves in the top row — the
      // heaviest legal unit in both module count and part count.
      modules.push({
        type: row === height - 1 ? "SHELF" : "DRAWER",
        column,
        row,
      });
    }
  }
  return { width, height, finish: "CHARCOAL", modules };
}

export const EXAMPLES: Readonly<Record<ExampleName, Configuration>> = {
  minimum: {
    width: LIMITS.minWidth,
    height: LIMITS.minHeight,
    finish: "OAK",
    modules: [{ type: "SHELF", column: 0, row: 0 }],
  },
  mixed: {
    width: 5,
    height: 4,
    finish: "OAK",
    modules: [
      { type: "DOOR", column: 0, row: 0 },
      { type: "DRAWER", column: 1, row: 0 },
      { type: "DRAWER", column: 1, row: 1 },
      { type: "SHELF", column: 1, row: 3 },
      { type: "DOOR", column: 3, row: 1 },
      { type: "SHELF", column: 4, row: 0 },
      { type: "DRAWER", column: 4, row: 1 },
      { type: "DOOR", column: 4, row: 2 },
    ],
  },
  maximum: largest(),
};

export const EXAMPLE_LABELS: Readonly<Record<ExampleName, string>> = {
  minimum: "Smallest unit",
  mixed: "Doors and drawers",
  maximum: "Largest unit",
};

export function isExampleName(value: string | undefined): value is ExampleName {
  return EXAMPLE_NAMES.some((name) => name === value);
}
