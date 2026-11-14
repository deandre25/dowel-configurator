import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/domain/catalogue";
import { centreSupportColumn, type Configuration } from "@/lib/domain/grid";
import { validateConfiguration } from "@/lib/domain/rules";
import {
  STARTING_CONFIGURATION,
  moduleAt,
  occupancy,
  reduce,
  reservedCell,
  toInput,
} from "@/lib/configurator/state";

const start: Configuration = {
  width: 4,
  height: 3,
  finish: "OAK",
  modules: [
    { type: "DRAWER", column: 0, row: 0 },
    { type: "SHELF", column: 1, row: 1 },
    { type: "DOOR", column: 3, row: 0 },
  ],
};

describe("the configuration a visitor starts with", () => {
  it("is legal", () => {
    expect(validateConfiguration(STARTING_CONFIGURATION)).toEqual({
      valid: true,
    });
  });

  it("uses all three module types, so every control has been demonstrated", () => {
    const types = new Set(STARTING_CONFIGURATION.modules.map((m) => m.type));
    expect(types).toEqual(new Set(["SHELF", "DRAWER", "DOOR"]));
  });
});

describe("setCell", () => {
  it("puts a module in an empty bay", () => {
    const next = reduce(start, {
      type: "setCell",
      cell: { column: 2, row: 2 },
      module: "SHELF",
    });
    expect(moduleAt(next, { column: 2, row: 2 })?.module.type).toBe("SHELF");
  });

  it("replaces what was there rather than stacking on it", () => {
    const next = reduce(start, {
      type: "setCell",
      cell: { column: 0, row: 0 },
      module: "SHELF",
    });
    expect(next.modules).toHaveLength(start.modules.length);
    expect(moduleAt(next, { column: 0, row: 0 })?.module.type).toBe("SHELF");
    expect(validateConfiguration(next)).toEqual({ valid: true });
  });

  it("empties a bay", () => {
    const next = reduce(start, {
      type: "setCell",
      cell: { column: 0, row: 0 },
      module: null,
    });
    expect(moduleAt(next, { column: 0, row: 0 })).toBeNull();
    expect(next.modules).toHaveLength(start.modules.length - 1);
  });

  it("takes the bay above as well when a door goes in, clearing what was there", () => {
    const withShelfAbove = reduce(start, {
      type: "setCell",
      cell: { column: 2, row: 1 },
      module: "SHELF",
    });
    const next = reduce(withShelfAbove, {
      type: "setCell",
      cell: { column: 2, row: 0 },
      module: "DOOR",
    });
    expect(moduleAt(next, { column: 2, row: 0 })?.isAnchor).toBe(true);
    expect(moduleAt(next, { column: 2, row: 1 })?.isAnchor).toBe(false);
    expect(moduleAt(next, { column: 2, row: 1 })?.module.type).toBe("DOOR");
    expect(validateConfiguration(next)).toEqual({ valid: true });
  });

  it("removes the whole door when either of its bays is changed", () => {
    for (const row of [0, 1]) {
      const next = reduce(start, {
        type: "setCell",
        cell: { column: 3, row },
        module: null,
      });
      expect(moduleAt(next, { column: 3, row: 0 })).toBeNull();
      expect(moduleAt(next, { column: 3, row: 1 })).toBeNull();
    }
  });

  it("never leaves two modules claiming one bay, whatever the sequence", () => {
    let configuration = start;
    const types = ["SHELF", "DRAWER", "DOOR", null] as const;
    for (let step = 0; step < 200; step += 1) {
      configuration = reduce(configuration, {
        type: "setCell",
        cell: { column: step % 4, row: Math.floor(step / 4) % 3 },
        module: types[step % 4] ?? null,
      });
      const covered = occupancy(configuration);
      const cellsCovered = configuration.modules.reduce(
        (total, module) => total + (module.type === "DOOR" ? 2 : 1),
        0,
      );
      // Every covered bay appears once, so no two modules overlap.
      expect(covered.size).toBe(cellsCovered);
    }
  });
});

describe("changing the size", () => {
  it("clamps to the limits the catalogue declares", () => {
    expect(reduce(start, { type: "setWidth", width: 99 }).width).toBe(
      LIMITS.maxWidth,
    );
    expect(reduce(start, { type: "setWidth", width: 0 }).width).toBe(
      LIMITS.minWidth,
    );
    expect(reduce(start, { type: "setHeight", height: 99 }).height).toBe(
      LIMITS.maxHeight,
    );
    expect(reduce(start, { type: "setHeight", height: -4 }).height).toBe(
      LIMITS.minHeight,
    );
  });

  it("drops modules that no longer fit when the unit narrows", () => {
    const next = reduce(start, { type: "setWidth", width: 2 });
    expect(moduleAt(next, { column: 3, row: 0 })).toBeNull();
    expect(moduleAt(next, { column: 0, row: 0 })?.module.type).toBe("DRAWER");
    expect(validateConfiguration(next)).toEqual({ valid: true });
  });

  it("drops a drawer that the new top row would put out of reach", () => {
    const tall = reduce(start, { type: "setHeight", height: 5 });
    const withTopDrawer = reduce(tall, {
      type: "setCell",
      cell: { column: 0, row: 3 },
      module: "DRAWER",
    });
    const shortened = reduce(withTopDrawer, { type: "setHeight", height: 4 });
    expect(moduleAt(shortened, { column: 0, row: 3 })).toBeNull();
    expect(validateConfiguration(shortened)).toEqual({ valid: true });
  });

  it("drops a module standing where a centre support appears", () => {
    const narrow: Configuration = {
      width: 4,
      height: 3,
      finish: "OAK",
      modules: [{ type: "SHELF", column: 2, row: 0 }],
    };
    expect(validateConfiguration(narrow)).toEqual({ valid: true });

    const widened = reduce(narrow, { type: "setWidth", width: 5 });
    expect(reservedCell(5)).toEqual({ column: centreSupportColumn(5), row: 0 });
    expect(moduleAt(widened, reservedCell(5) ?? { column: 0, row: 0 })).toBeNull();

    // That shelf was the only module, so the unit is now empty — which the
    // server reports as EMPTY_UNIT and the interface shows. Dropping the
    // module is right; pretending the result is still a unit would not be.
    const result = validateConfiguration(widened);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations.map((v) => v.code)).toEqual(["EMPTY_UNIT"]);
    }
  });

  it("keeps the rest of the unit when the support displaces one module", () => {
    const populated: Configuration = {
      width: 4,
      height: 3,
      finish: "OAK",
      modules: [
        { type: "SHELF", column: 2, row: 0 },
        { type: "SHELF", column: 0, row: 0 },
      ],
    };
    const widened = reduce(populated, { type: "setWidth", width: 5 });
    expect(moduleAt(widened, { column: 2, row: 0 })).toBeNull();
    expect(moduleAt(widened, { column: 0, row: 0 })?.module.type).toBe("SHELF");
    expect(validateConfiguration(widened)).toEqual({ valid: true });
  });

  it("leaves a configuration the rules accept, for every size from every size", () => {
    // The point of fitToGrid: resizing is never what makes a unit illegal.
    for (let width = LIMITS.minWidth; width <= LIMITS.maxWidth; width += 1) {
      for (
        let height = LIMITS.minHeight;
        height <= LIMITS.maxHeight;
        height += 1
      ) {
        const sized = reduce(
          reduce(
            { ...start, width: LIMITS.maxWidth, height: LIMITS.maxHeight },
            { type: "setWidth", width },
          ),
          { type: "setHeight", height },
        );
        const result = validateConfiguration(sized);
        // An empty unit is the one legitimate failure: everything was dropped.
        if (!result.valid) {
          expect(result.violations.map((v) => v.code)).toEqual(["EMPTY_UNIT"]);
        }
      }
    }
  });
});

describe("the other actions", () => {
  it("changes the finish without touching the modules", () => {
    const next = reduce(start, { type: "setFinish", finish: "CHARCOAL" });
    expect(next.finish).toBe("CHARCOAL");
    expect(next.modules).toEqual(start.modules);
  });

  it("restores a configuration wholesale, for a share link", () => {
    const shared: Configuration = {
      width: 6,
      height: 5,
      finish: "WHITE",
      modules: [{ type: "SHELF", column: 0, row: 0 }],
    };
    expect(reduce(start, { type: "restore", configuration: shared })).toEqual(
      shared,
    );
  });
});

describe("toInput", () => {
  it("sends the module's anchor and nothing derived from it", () => {
    expect(toInput(start)).toEqual({
      width: 4,
      height: 3,
      finish: "OAK",
      modules: [
        { type: "DRAWER", column: 0, row: 0 },
        { type: "SHELF", column: 1, row: 1 },
        { type: "DOOR", column: 3, row: 0 },
      ],
    });
  });
});
