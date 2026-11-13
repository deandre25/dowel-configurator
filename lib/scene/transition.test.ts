import { describe, expect, it } from "vitest";
import type { Configuration, PlacedModule } from "@/lib/domain/grid";
import { assembleUnit, partsOfType } from "@/lib/scene/assembly";
import { PartTransition } from "@/lib/scene/transition";

function unit(
  width: number,
  height: number,
  modules: readonly PlacedModule[] = [],
): Configuration {
  return { width, height, finish: "OAK", modules };
}

/** Runs the transition to a standstill, or fails if it never settles. */
function settle(transition: PartTransition, step = 1 / 60): number {
  for (let frame = 1; frame <= 600; frame += 1) {
    if (!transition.advance(step)) {
      return frame;
    }
  }
  throw new Error("the transition did not settle within 10 seconds");
}

function keysOf(transition: PartTransition): readonly string[] {
  return [...transition.byType().values()]
    .flat()
    .map((part) => part.key)
    .sort();
}

describe("the first configuration", () => {
  it("grows in rather than appearing at full size", () => {
    const transition = new PartTransition();
    transition.setTarget(assembleUnit(unit(3, 3)));
    const boards = transition.byType().get("board") ?? [];
    expect(boards.length).toBeGreaterThan(0);
    expect(boards.every((part) => part.pose.scale[1] === 0)).toBe(true);
    expect(transition.isMoving).toBe(true);
  });

  it("reaches its target and then stops reporting movement", () => {
    const transition = new PartTransition();
    const parts = assembleUnit(unit(3, 3));
    transition.setTarget(parts);
    const frames = settle(transition);
    expect(frames).toBeLessThan(120);
    expect(transition.isMoving).toBe(false);

    for (const tracked of [...transition.byType().values()].flat()) {
      const part = parts.find((candidate) => candidate.key === tracked.key);
      expect(part).toBeDefined();
      expect(tracked.pose).toEqual({
        position: part?.position,
        scale: part?.scale,
        rotation: part?.rotation,
      });
    }
  });
});

describe("reduced motion", () => {
  it("arrives immediately and never reports movement", () => {
    const transition = new PartTransition(true);
    const parts = assembleUnit(unit(3, 3));
    transition.setTarget(parts);
    expect(transition.isMoving).toBe(false);
    expect(transition.advance(1 / 60)).toBe(false);

    const boards = transition.byType().get("board") ?? [];
    const expected = partsOfType(parts, "board");
    expect(boards).toHaveLength(expected.length);
    expect(boards.every((part) => part.pose.scale[1] > 0)).toBe(true);
  });

  it("drops a part that has left, without a shrinking frame", () => {
    const transition = new PartTransition(true);
    transition.setTarget(assembleUnit(unit(5, 3)));
    transition.setTarget(assembleUnit(unit(3, 3)));
    expect(keysOf(transition)).not.toContain("upright:4");
    expect(keysOf(transition)).not.toContain("support:0");
  });
});

describe("a change of size", () => {
  it("keeps the parts that persist, and moves them", () => {
    const transition = new PartTransition();
    transition.setTarget(assembleUnit(unit(3, 3)));
    settle(transition);

    const before = new Map(
      [...transition.byType().values()].flat().map((p) => [p.key, p.pose]),
    );
    transition.setTarget(assembleUnit(unit(5, 3)));

    // The leftmost upright persists but the unit re-centres, so it must move.
    const tracked = [...transition.byType().values()]
      .flat()
      .find((part) => part.key === "upright:0");
    expect(tracked).toBeDefined();
    expect(tracked?.leaving).toBe(false);
    expect(tracked?.target.position[0]).not.toBeCloseTo(
      before.get("upright:0")?.position[0] ?? 0,
      6,
    );
  });

  it("grows the new columns in from flat", () => {
    const transition = new PartTransition();
    transition.setTarget(assembleUnit(unit(3, 3)));
    settle(transition);
    transition.setTarget(assembleUnit(unit(5, 3)));

    const fresh = [...transition.byType().values()]
      .flat()
      .filter((part) => part.key === "upright:4" || part.key === "support:0");
    expect(fresh).toHaveLength(2);
    expect(fresh.every((part) => part.pose.scale[1] === 0)).toBe(true);
    expect(fresh.every((part) => part.target.scale[1] > 0)).toBe(true);
  });

  it("shrinks the removed columns out and then drops them", () => {
    const transition = new PartTransition();
    transition.setTarget(assembleUnit(unit(5, 3)));
    settle(transition);
    expect(keysOf(transition)).toContain("upright:5");

    transition.setTarget(assembleUnit(unit(3, 3)));
    const leaving = [...transition.byType().values()]
      .flat()
      .filter((part) => part.leaving);
    expect(leaving.length).toBeGreaterThan(0);
    expect(leaving.every((part) => part.target.scale[1] === 0)).toBe(true);

    settle(transition);
    const remaining = keysOf(transition);
    expect(remaining).not.toContain("upright:5");
    expect(remaining).not.toContain("support:0");
    expect(remaining).toEqual(
      assembleUnit(unit(3, 3))
        .map((part) => part.key)
        .sort(),
    );
  });

  it("settles to exactly the same state whatever the frame rate", () => {
    const slow = new PartTransition();
    const fast = new PartTransition();
    for (const transition of [slow, fast]) {
      transition.setTarget(assembleUnit(unit(2, 2)));
    }
    settle(slow, 1 / 30);
    settle(fast, 1 / 144);

    const poses = (t: PartTransition): Record<string, unknown> =>
      Object.fromEntries(
        [...t.byType().values()].flat().map((p) => [p.key, p.pose]),
      );
    expect(poses(slow)).toEqual(poses(fast));
  });

  it("does not grow without bound when configurations change repeatedly", () => {
    // Every intermediate configuration leaves parts behind. They must be
    // dropped, not accumulated: an instanced mesh has a fixed capacity.
    const transition = new PartTransition();
    const configurationFor = (round: number): Configuration =>
      unit(2 + (round % 5), 3, [
        { type: "DRAWER", column: 0, row: round % 2 },
      ]);

    const rounds = 50;
    for (let round = 0; round < rounds; round += 1) {
      transition.setTarget(assembleUnit(configurationFor(round)));
      // One frame only, so each change interrupts the one before it.
      transition.advance(1 / 60);
    }
    expect(transition.size).toBeGreaterThan(
      assembleUnit(configurationFor(rounds - 1)).length,
    );

    settle(transition);
    expect(transition.size).toBe(
      assembleUnit(configurationFor(rounds - 1)).length,
    );
  });
});

describe("instance order", () => {
  it("is stable, so an instance index keeps belonging to the same part", () => {
    const transition = new PartTransition();
    transition.setTarget(
      assembleUnit(
        unit(4, 3, [
          { type: "DRAWER", column: 0, row: 0 },
          { type: "DRAWER", column: 2, row: 1 },
          { type: "DOOR", column: 3, row: 0 },
        ]),
      ),
    );
    const first = transition.byType().get("drawerFront")?.map((p) => p.key);
    transition.advance(1 / 60);
    const second = transition.byType().get("drawerFront")?.map((p) => p.key);
    expect(second).toEqual(first);
  });
});
