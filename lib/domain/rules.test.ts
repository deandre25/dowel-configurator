import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/domain/catalogue";
import {
  centreSupportColumn,
  type Configuration,
  type Finish,
  type PlacedModule,
} from "@/lib/domain/grid";
import {
  RULE_CODES,
  validateConfiguration,
  type RuleCode,
} from "@/lib/domain/rules";

function unit(
  width: number,
  height: number,
  modules: readonly PlacedModule[],
  finish: Finish = "OAK",
): Configuration {
  return { width, height, finish, modules };
}

function shelf(column: number, row: number): PlacedModule {
  return { type: "SHELF", column, row };
}

function drawer(column: number, row: number): PlacedModule {
  return { type: "DRAWER", column, row };
}

function door(column: number, row: number): PlacedModule {
  return { type: "DOOR", column, row };
}

function codes(configuration: Configuration): readonly RuleCode[] {
  const result = validateConfiguration(configuration);
  return result.valid ? [] : result.violations.map((v) => v.code);
}

describe("dimensions", () => {
  it("accepts every width and height in range", () => {
    for (let width = LIMITS.minWidth; width <= LIMITS.maxWidth; width += 1) {
      for (
        let height = LIMITS.minHeight;
        height <= LIMITS.maxHeight;
        height += 1
      ) {
        // One shelf, placed where no rule can object to it: bottom-left, and
        // never the cell a centre support would claim.
        const column = centreSupportColumn(width) === 0 ? 1 : 0;
        expect(codes(unit(width, height, [shelf(column, 0)]))).toEqual([]);
      }
    }
  });

  it("rejects each dimension one step outside its range", () => {
    const outside: readonly [number, number][] = [
      [LIMITS.minWidth - 1, LIMITS.minHeight],
      [LIMITS.maxWidth + 1, LIMITS.minHeight],
      [LIMITS.minWidth, LIMITS.minHeight - 1],
      [LIMITS.minWidth, LIMITS.maxHeight + 1],
    ];
    for (const [width, height] of outside) {
      expect(codes(unit(width, height, [shelf(0, 0)]))).toContain(
        "DIMENSIONS_OUT_OF_RANGE",
      );
    }
  });

  it("rejects a non-integer dimension", () => {
    expect(codes(unit(3.5, 3, [shelf(0, 0)]))).toContain(
      "DIMENSIONS_OUT_OF_RANGE",
    );
  });

  it("reports dimension problems alone, because cell checks would be relative to a unit that cannot exist", () => {
    // A drawer in the top row and a bad width. Only the width is reported.
    expect(codes(unit(99, 3, [drawer(0, 2)]))).toEqual([
      "DIMENSIONS_OUT_OF_RANGE",
    ]);
  });
});

describe("rule 1 — a drawer may not occupy a cell in the top row", () => {
  it("rejects a drawer in the top row, at every height", () => {
    for (
      let height = LIMITS.minHeight;
      height <= LIMITS.maxHeight;
      height += 1
    ) {
      expect(codes(unit(3, height, [drawer(0, height - 1)]))).toEqual([
        "DRAWER_IN_TOP_ROW",
      ]);
    }
  });

  it("accepts a drawer in the row directly below the top — the boundary", () => {
    for (
      let height = LIMITS.minHeight;
      height <= LIMITS.maxHeight;
      height += 1
    ) {
      expect(codes(unit(3, height, [drawer(0, height - 2)]))).toEqual([]);
    }
  });

  it("accepts a drawer in the bottom row", () => {
    expect(codes(unit(3, 5, [drawer(0, 0)]))).toEqual([]);
  });

  it("says nothing about a shelf in the top row", () => {
    expect(codes(unit(3, 3, [shelf(0, 2)]))).toEqual([]);
  });
});

describe("rule 2 — a door occupies two vertically adjacent cells, both free", () => {
  it("rejects a door anchored in the top row, at every height", () => {
    for (
      let height = LIMITS.minHeight;
      height <= LIMITS.maxHeight;
      height += 1
    ) {
      expect(codes(unit(3, height, [door(0, height - 1)]))).toEqual([
        "DOOR_SPANS_TOP_EDGE",
      ]);
    }
  });

  it("accepts a door whose upper cell is the top row — the boundary", () => {
    for (
      let height = LIMITS.minHeight;
      height <= LIMITS.maxHeight;
      height += 1
    ) {
      expect(codes(unit(3, height, [door(0, height - 2)]))).toEqual([]);
    }
  });

  it("rejects a door whose upper cell is taken", () => {
    expect(codes(unit(3, 4, [door(0, 0), shelf(0, 1)]))).toEqual([
      "CELL_OCCUPIED",
    ]);
  });

  it("rejects a door whose lower cell is taken", () => {
    expect(codes(unit(3, 4, [shelf(0, 0), door(0, 0)]))).toEqual([
      "CELL_OCCUPIED",
    ]);
  });

  it("rejects two doors overlapping by one cell", () => {
    expect(codes(unit(3, 4, [door(0, 0), door(0, 1)]))).toEqual([
      "CELL_OCCUPIED",
    ]);
  });

  it("accepts two doors stacked exactly, without overlap", () => {
    expect(codes(unit(3, 4, [door(0, 0), door(0, 2)]))).toEqual([]);
  });

  it("accepts doors side by side", () => {
    expect(codes(unit(3, 3, [door(0, 0), door(1, 0), door(2, 0)]))).toEqual([]);
  });
});

describe("rule 3 — a unit over four columns keeps its centre bottom cell for the support", () => {
  it("reserves nothing at or below the threshold", () => {
    for (
      let width = LIMITS.minWidth;
      width <= LIMITS.maxWidthWithoutSupport;
      width += 1
    ) {
      const centre = centreSupportColumn(width);
      expect(codes(unit(width, 3, [shelf(centre, 0)]))).toEqual([]);
    }
  });

  it("rejects a module in the reserved cell above the threshold", () => {
    for (
      let width = LIMITS.maxWidthWithoutSupport + 1;
      width <= LIMITS.maxWidth;
      width += 1
    ) {
      const centre = centreSupportColumn(width);
      expect(codes(unit(width, 3, [shelf(centre, 0)]))).toEqual([
        "CELL_RESERVED_FOR_SUPPORT",
      ]);
    }
  });

  it("rejects a door that reaches down into the reserved cell", () => {
    const centre = centreSupportColumn(5);
    expect(codes(unit(5, 3, [door(centre, 0)]))).toEqual([
      "CELL_RESERVED_FOR_SUPPORT",
    ]);
  });

  it("accepts the reserved column above the bottom row", () => {
    const centre = centreSupportColumn(5);
    expect(codes(unit(5, 3, [shelf(centre, 1), door(centre, 1)]))).toContain(
      "CELL_OCCUPIED",
    );
    expect(codes(unit(5, 3, [shelf(centre, 1)]))).toEqual([]);
  });

  it("accepts the bottom row either side of the support", () => {
    const centre = centreSupportColumn(6);
    expect(
      codes(unit(6, 3, [shelf(centre - 1, 0), shelf(centre + 1, 0)])),
    ).toEqual([]);
  });
});

describe("rule 4 — a unit may not be entirely empty", () => {
  it("rejects a grid with no modules", () => {
    expect(codes(unit(3, 3, []))).toEqual(["EMPTY_UNIT"]);
  });

  it("accepts a grid with one module and the rest empty", () => {
    expect(codes(unit(6, 5, [shelf(0, 0)]))).toEqual([]);
  });
});

describe("bounds", () => {
  it("rejects a module past the right-hand column", () => {
    expect(codes(unit(3, 3, [shelf(3, 0)]))).toEqual(["OUT_OF_BOUNDS"]);
  });

  it("rejects a shelf above the top row", () => {
    expect(codes(unit(3, 3, [shelf(0, 3)]))).toEqual(["OUT_OF_BOUNDS"]);
  });

  it("rejects negative coordinates", () => {
    expect(codes(unit(3, 3, [shelf(-1, 0)]))).toEqual(["OUT_OF_BOUNDS"]);
    expect(codes(unit(3, 3, [shelf(0, -1)]))).toEqual(["OUT_OF_BOUNDS"]);
  });

  it("rejects a non-integer coordinate", () => {
    expect(codes(unit(3, 3, [shelf(0.5, 0)]))).toEqual(["OUT_OF_BOUNDS"]);
  });

  it("accepts every cell of the largest unit that no other rule forbids", () => {
    const width = LIMITS.maxWidth;
    const height = LIMITS.maxHeight;
    const reserved = centreSupportColumn(width);
    for (let column = 0; column < width; column += 1) {
      for (let row = 0; row < height; row += 1) {
        if (row === 0 && column === reserved) {
          continue;
        }
        expect(codes(unit(width, height, [shelf(column, row)]))).toEqual([]);
      }
    }
  });
});

describe("configurations that are valid for non-obvious reasons", () => {
  it("accepts a full six-by-five unit built around the support", () => {
    const width = 6;
    const height = 5;
    const reserved = centreSupportColumn(width);
    const modules: PlacedModule[] = [];
    for (let column = 0; column < width; column += 1) {
      for (let row = 0; row < height; row += 1) {
        if (row === 0 && column === reserved) {
          continue;
        }
        // Drawers wherever they are allowed, shelves in the top row.
        modules.push(
          row === height - 1 ? shelf(column, row) : drawer(column, row),
        );
      }
    }
    expect(codes(unit(width, height, modules))).toEqual([]);
  });

  it("accepts a door directly above a drawer, which is two rules nearly colliding", () => {
    // Height 4: drawer at row 0, door covering rows 1 and 2, top row empty.
    expect(codes(unit(3, 4, [drawer(0, 0), door(0, 1)]))).toEqual([]);
  });

  it("accepts a door in the reserved column of a wide unit, provided it starts above the bottom row", () => {
    const centre = centreSupportColumn(5);
    expect(codes(unit(5, 4, [door(centre, 1)]))).toEqual([]);
  });

  it("accepts the smallest legal unit", () => {
    expect(codes(unit(LIMITS.minWidth, LIMITS.minHeight, [shelf(0, 0)]))).toEqual(
      [],
    );
  });

  it("reports every rule a configuration breaks, not only the first", () => {
    const broken = unit(5, 3, [
      drawer(0, 2), // top row
      door(1, 2), // spans the top edge
      shelf(centreSupportColumn(5), 0), // the support's cell
      shelf(4, 0),
      shelf(4, 0), // same cell twice
    ]);
    const reported = codes(broken);
    expect(reported).toContain("DRAWER_IN_TOP_ROW");
    expect(reported).toContain("DOOR_SPANS_TOP_EDGE");
    expect(reported).toContain("CELL_RESERVED_FOR_SUPPORT");
    expect(reported).toContain("CELL_OCCUPIED");
  });
});

describe("the shape of a violation", () => {
  it("names the cell it is about, so the interface can point at it", () => {
    const result = validateConfiguration(unit(3, 3, [drawer(1, 2)]));
    expect(result.valid).toBe(false);
    if (result.valid) {
      return;
    }
    const [violation] = result.violations;
    expect(violation).toMatchObject({
      code: "DRAWER_IN_TOP_ROW",
      cells: [{ column: 1, row: 2 }],
      moduleIndex: 0,
    });
    expect(violation?.message).toMatch(/top row/);
  });

  it("carries no cell for a violation about the whole unit", () => {
    const result = validateConfiguration(unit(3, 3, []));
    expect(result.valid).toBe(false);
    if (result.valid) {
      return;
    }
    expect(result.violations[0]?.cells).toEqual([]);
    expect(result.violations[0]?.moduleIndex).toBeNull();
  });

  it("uses a message written for a person, for every code the module can emit", () => {
    // Guards against a code being added with a placeholder message.
    const samples: Readonly<Record<RuleCode, Configuration>> = {
      DIMENSIONS_OUT_OF_RANGE: unit(99, 3, [shelf(0, 0)]),
      EMPTY_UNIT: unit(3, 3, []),
      OUT_OF_BOUNDS: unit(3, 3, [shelf(9, 0)]),
      DRAWER_IN_TOP_ROW: unit(3, 3, [drawer(0, 2)]),
      DOOR_SPANS_TOP_EDGE: unit(3, 3, [door(0, 2)]),
      CELL_OCCUPIED: unit(3, 3, [shelf(0, 0), shelf(0, 0)]),
      CELL_RESERVED_FOR_SUPPORT: unit(5, 3, [
        shelf(centreSupportColumn(5), 0),
      ]),
    };

    for (const code of RULE_CODES) {
      const result = validateConfiguration(samples[code]);
      expect(result.valid, `${code} sample should be invalid`).toBe(false);
      if (result.valid) {
        continue;
      }
      const violation = result.violations.find((v) => v.code === code);
      expect(violation, `no violation with code ${code}`).toBeDefined();
      expect(violation?.message.length).toBeGreaterThan(20);
      expect(violation?.message).toMatch(/[.—]/);
    }
  });
});
