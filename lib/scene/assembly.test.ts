import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/domain/catalogue";
import {
  centreSupportColumn,
  type Configuration,
  type PlacedModule,
} from "@/lib/domain/grid";
import { validateConfiguration } from "@/lib/domain/rules";
import {
  PART_CAPACITY,
  PART_TYPES,
  assembleUnit,
  partsOfType,
  type Part,
  type PartType,
} from "@/lib/scene/assembly";
import { DIMENSIONS, unitSize } from "@/lib/scene/dimensions";

function unit(
  width: number,
  height: number,
  modules: readonly PlacedModule[] = [],
): Configuration {
  return { width, height, finish: "OAK", modules };
}

function bounds(parts: readonly Part[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} {
  const result = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  for (const part of parts) {
    const [x, y, z] = part.position;
    // A rod is laid flat by a quarter turn about Z, which swaps its X and Y
    // extents. The bounds have to account for that or they are wrong for pulls.
    const turned = part.rotation[2] !== 0;
    const [sx, sy, sz] = part.scale;
    const halfX = (turned ? sy : sx) / 2;
    const halfY = (turned ? sx : sy) / 2;
    const halfZ = sz / 2;
    result.minX = Math.min(result.minX, x - halfX);
    result.maxX = Math.max(result.maxX, x + halfX);
    result.minY = Math.min(result.minY, y - halfY);
    result.maxY = Math.max(result.maxY, y + halfY);
    result.minZ = Math.min(result.minZ, z - halfZ);
    result.maxZ = Math.max(result.maxZ, z + halfZ);
  }
  return result;
}

function everyLegalSize(): readonly [number, number][] {
  const sizes: [number, number][] = [];
  for (let width = LIMITS.minWidth; width <= LIMITS.maxWidth; width += 1) {
    for (let height = LIMITS.minHeight; height <= LIMITS.maxHeight; height += 1) {
      sizes.push([width, height]);
    }
  }
  return sizes;
}

describe("the frame", () => {
  it("has an upright at each side of every bay, and a board under every row plus a top", () => {
    for (const [width, height] of everyLegalSize()) {
      const parts = assembleUnit(unit(width, height));
      expect(partsOfType(parts, "upright")).toHaveLength(width + 1);
      expect(partsOfType(parts, "board")).toHaveLength(height + 1);
      expect(partsOfType(parts, "back")).toHaveLength(1);
    }
  });

  it("stands on the floor and is centred left to right", () => {
    for (const [width, height] of everyLegalSize()) {
      const size = unitSize(width, height);
      const box = bounds(assembleUnit(unit(width, height)));
      expect(box.minY).toBeCloseTo(0, 6);
      expect(box.maxY).toBeCloseTo(size.height, 6);
      expect(box.minX).toBeCloseTo(-size.width / 2, 6);
      expect(box.maxX).toBeCloseTo(size.width / 2, 6);
    }
  });

  it("grows by exactly one bay and one panel for each extra column", () => {
    const narrow = unitSize(3, 3);
    const wider = unitSize(4, 3);
    expect(wider.width - narrow.width).toBeCloseTo(
      DIMENSIONS.bayWidth + DIMENSIONS.panelThickness,
      9,
    );
  });

  it("carries a centre support above four columns and none at or below", () => {
    for (const [width, height] of everyLegalSize()) {
      const supports = partsOfType(assembleUnit(unit(width, height)), "support");
      expect(supports).toHaveLength(
        width > LIMITS.maxWidthWithoutSupport ? 1 : 0,
      );
    }
  });

  it("puts the support in the bay the rules reserve", () => {
    const width = 5;
    const parts = assembleUnit(unit(width, 3));
    const support = partsOfType(parts, "support")[0];
    const reservedBayUpright = partsOfType(parts, "upright")[
      centreSupportColumn(width)
    ];
    expect(support).toBeDefined();
    expect(reservedBayUpright).toBeDefined();
    // It stands within the reserved bay: between that bay's two uprights.
    const left = reservedBayUpright?.position[0] ?? 0;
    expect(support?.position[0]).toBeGreaterThan(left);
    expect(support?.position[0]).toBeLessThan(
      left + DIMENSIONS.bayWidth + DIMENSIONS.panelThickness,
    );
    // And only in the bottom row.
    expect(support?.position[1]).toBeLessThan(DIMENSIONS.bayHeight);
  });
});

describe("modules", () => {
  it("draws nothing for an open shelf, because the frame already describes it", () => {
    const empty = assembleUnit(unit(3, 3));
    const withShelves = assembleUnit(
      unit(3, 3, [
        { type: "SHELF", column: 0, row: 0 },
        { type: "SHELF", column: 1, row: 1 },
      ]),
    );
    expect(withShelves).toHaveLength(empty.length);
  });

  it("gives a drawer a front and a pull", () => {
    const parts = assembleUnit(
      unit(3, 3, [{ type: "DRAWER", column: 1, row: 0 }]),
    );
    expect(partsOfType(parts, "drawerFront")).toHaveLength(1);
    expect(partsOfType(parts, "drawerPull")).toHaveLength(1);
  });

  it("gives a door a panel and a pull, and the panel covers two bays", () => {
    const parts = assembleUnit(
      unit(3, 3, [{ type: "DOOR", column: 1, row: 0 }]),
    );
    const panel = partsOfType(parts, "doorPanel")[0];
    expect(panel).toBeDefined();
    const expected =
      DIMENSIONS.bayHeight * 2 + DIMENSIONS.panelThickness - DIMENSIONS.reveal;
    expect(panel?.scale[1]).toBeCloseTo(expected, 9);
    expect(partsOfType(parts, "doorPull")).toHaveLength(1);
  });

  it("lays a drawer pull flat and leaves a door pull upright", () => {
    const parts = assembleUnit(
      unit(3, 3, [
        { type: "DRAWER", column: 0, row: 0 },
        { type: "DOOR", column: 1, row: 0 },
      ]),
    );
    expect(partsOfType(parts, "drawerPull")[0]?.rotation[2]).toBeCloseTo(
      Math.PI / 2,
      9,
    );
    expect(partsOfType(parts, "doorPull")[0]?.rotation).toEqual([0, 0, 0]);
  });

  it("sets fronts into the frame, so a reveal shows all round", () => {
    const parts = assembleUnit(
      unit(3, 3, [{ type: "DRAWER", column: 1, row: 1 }]),
    );
    const front = partsOfType(parts, "drawerFront")[0];
    expect(front?.scale[0]).toBeCloseTo(
      DIMENSIONS.bayWidth - DIMENSIONS.reveal,
      9,
    );
    expect(front?.scale[1]).toBeCloseTo(
      DIMENSIONS.bayHeight - DIMENSIONS.reveal,
      9,
    );
  });

  it("keeps every part of a full unit inside the frame, pulls apart", () => {
    const width = LIMITS.maxWidth;
    const height = LIMITS.maxHeight;
    const reserved = centreSupportColumn(width);
    const modules: PlacedModule[] = [];
    for (let column = 0; column < width; column += 1) {
      for (let row = 0; row < height; row += 1) {
        if (row === 0 && column === reserved) {
          continue;
        }
        modules.push({
          type: row === height - 1 ? "SHELF" : "DRAWER",
          column,
          row,
        });
      }
    }
    const configuration = unit(width, height, modules);
    expect(validateConfiguration(configuration)).toEqual({ valid: true });

    const parts = assembleUnit(configuration);
    const size = unitSize(width, height);
    for (const part of parts) {
      const halfWidth = part.scale[0] / 2;
      expect(Math.abs(part.position[0]) + halfWidth).toBeLessThanOrEqual(
        size.width / 2 + 1e-9,
      );
      // Pulls stand off the front face on purpose; nothing else does.
      const frontLimit =
        part.type === "drawerPull" || part.type === "doorPull"
          ? size.depth / 2 + DIMENSIONS.pullStandoff + DIMENSIONS.pullRadius
          : size.depth / 2 + 1e-9;
      expect(part.position[2] + part.scale[2] / 2).toBeLessThanOrEqual(
        frontLimit,
      );
    }
  });
});

describe("keys", () => {
  it("are unique within an assembly", () => {
    const parts = assembleUnit(
      unit(6, 5, [
        { type: "DRAWER", column: 0, row: 0 },
        { type: "DOOR", column: 1, row: 0 },
        { type: "SHELF", column: 2, row: 2 },
        { type: "DRAWER", column: 4, row: 3 },
      ]),
    );
    const keys = parts.map((part) => part.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("identify the same part across a change of size, so it can move rather than be rebuilt", () => {
    const before = assembleUnit(unit(3, 3, [{ type: "DRAWER", column: 0, row: 0 }]));
    const after = assembleUnit(unit(5, 3, [{ type: "DRAWER", column: 0, row: 0 }]));
    const beforeKeys = new Set(before.map((part) => part.key));
    const afterKeys = new Set(after.map((part) => part.key));

    // The drawer and the first uprights persist; the new columns' parts appear.
    expect(afterKeys).toContain("drawerFront:0,0");
    expect(beforeKeys).toContain("drawerFront:0,0");
    expect(beforeKeys.has("upright:4")).toBe(false);
    expect(afterKeys.has("upright:4")).toBe(true);
    expect(afterKeys.has("support:0")).toBe(true);
  });

  it("do not depend on the order modules were placed in", () => {
    const modules: PlacedModule[] = [
      { type: "DRAWER", column: 0, row: 0 },
      { type: "DOOR", column: 1, row: 0 },
    ];
    const forwards = assembleUnit(unit(3, 3, modules)).map((p) => p.key).sort();
    const backwards = assembleUnit(unit(3, 3, [...modules].reverse()))
      .map((p) => p.key)
      .sort();
    expect(backwards).toEqual(forwards);
  });
});

describe("capacity", () => {
  it("is never exceeded by any legal configuration", () => {
    // The instanced meshes are allocated at these counts and never
    // reallocated, so an assembly that needed more would silently lose parts.
    const worst: Partial<Record<PartType, number>> = {};
    for (const [width, height] of everyLegalSize()) {
      const reserved = centreSupportColumn(width);
      for (const kind of ["DRAWER", "DOOR", "SHELF"] as const) {
        const modules: PlacedModule[] = [];
        for (let column = 0; column < width; column += 1) {
          for (let row = 0; row < height; row += 1) {
            if (row === 0 && column === reserved) {
              continue;
            }
            modules.push({ type: kind, column, row });
          }
        }
        // Not necessarily legal — the point is that even an input the rules
        // would reject cannot overflow the buffers.
        const parts = assembleUnit(unit(width, height, modules));
        for (const type of PART_TYPES) {
          const count = partsOfType(parts, type).length;
          worst[type] = Math.max(worst[type] ?? 0, count);
        }
      }
    }
    for (const type of PART_TYPES) {
      expect(worst[type] ?? 0, type).toBeLessThanOrEqual(PART_CAPACITY[type]);
    }
  });
});

describe("determinism", () => {
  it("produces an identical assembly for an identical configuration", () => {
    const configuration = unit(4, 3, [
      { type: "DRAWER", column: 0, row: 0 },
      { type: "DOOR", column: 2, row: 0 },
    ]);
    expect(assembleUnit(configuration)).toEqual(assembleUnit(configuration));
  });
});
