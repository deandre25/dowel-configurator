import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/domain/catalogue";
import { validateConfiguration } from "@/lib/domain/rules";
import { EXAMPLES, EXAMPLE_NAMES } from "@/lib/scene/examples";

describe("the example builds", () => {
  it("are every one of them legal", () => {
    for (const name of EXAMPLE_NAMES) {
      expect(validateConfiguration(EXAMPLES[name]), name).toEqual({
        valid: true,
      });
    }
  });

  it("include the smallest and the largest unit the system is built in", () => {
    expect(EXAMPLES.minimum.width).toBe(LIMITS.minWidth);
    expect(EXAMPLES.minimum.height).toBe(LIMITS.minHeight);
    expect(EXAMPLES.maximum.width).toBe(LIMITS.maxWidth);
    expect(EXAMPLES.maximum.height).toBe(LIMITS.maxHeight);
  });

  it("fill every bay of the largest unit that a module may occupy", () => {
    const { width, height, modules } = EXAMPLES.maximum;
    // Every bay but the one the centre support stands in.
    expect(modules).toHaveLength(width * height - 1);
  });

  it("use all three module types in the mixed build", () => {
    const types = new Set(EXAMPLES.mixed.modules.map((m) => m.type));
    expect(types).toEqual(new Set(["SHELF", "DRAWER", "DOOR"]));
  });

  it("use a width that needs a centre support in the mixed build", () => {
    expect(EXAMPLES.mixed.width).toBeGreaterThan(LIMITS.maxWidthWithoutSupport);
  });
});
