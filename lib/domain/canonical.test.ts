import { describe, expect, it } from "vitest";
import { canonicalForm, hashConfiguration } from "@/lib/domain/canonical";
import type { Configuration, PlacedModule } from "@/lib/domain/grid";

function unit(modules: readonly PlacedModule[]): Configuration {
  return { width: 4, height: 3, finish: "OAK", modules };
}

const A: readonly PlacedModule[] = [
  { type: "SHELF", column: 0, row: 0 },
  { type: "DRAWER", column: 1, row: 0 },
  { type: "DOOR", column: 2, row: 0 },
];

describe("canonicalForm", () => {
  it("does not depend on the order modules were placed in", () => {
    expect(canonicalForm(unit([...A].reverse()))).toBe(canonicalForm(unit(A)));
  });

  it("distinguishes two units that differ only in finish", () => {
    expect(canonicalForm({ ...unit(A), finish: "WHITE" })).not.toBe(
      canonicalForm(unit(A)),
    );
  });

  it("distinguishes two units that differ only in size", () => {
    expect(canonicalForm({ ...unit(A), width: 5 })).not.toBe(
      canonicalForm(unit(A)),
    );
    expect(canonicalForm({ ...unit(A), height: 4 })).not.toBe(
      canonicalForm(unit(A)),
    );
  });

  it("distinguishes a module moved to another bay", () => {
    expect(
      canonicalForm(unit([{ type: "SHELF", column: 3, row: 0 }])),
    ).not.toBe(canonicalForm(unit([{ type: "SHELF", column: 0, row: 0 }])));
  });

  it("distinguishes two module types in the same bay", () => {
    expect(
      canonicalForm(unit([{ type: "DRAWER", column: 0, row: 0 }])),
    ).not.toBe(canonicalForm(unit([{ type: "SHELF", column: 0, row: 0 }])));
  });

  it("carries a version, so the format can change without rewriting stored hashes", () => {
    expect(canonicalForm(unit(A)).startsWith("v1;")).toBe(true);
  });
});

describe("hashConfiguration", () => {
  it("is 64 hex characters", async () => {
    expect(await hashConfiguration(unit(A))).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is the same for the same build, whatever order it was assembled in", async () => {
    expect(await hashConfiguration(unit([...A].reverse()))).toBe(
      await hashConfiguration(unit(A)),
    );
  });

  it("differs for every pair of a set of distinct builds", async () => {
    const builds: readonly Configuration[] = [
      unit(A),
      { ...unit(A), finish: "WHITE" },
      { ...unit(A), width: 5 },
      { ...unit(A), height: 4 },
      unit([{ type: "SHELF", column: 0, row: 0 }]),
      unit([{ type: "DRAWER", column: 0, row: 0 }]),
      unit([{ type: "SHELF", column: 0, row: 1 }]),
    ];
    const hashes = await Promise.all(builds.map(hashConfiguration));
    expect(new Set(hashes).size).toBe(builds.length);
  });

  it("matches SHA-256 of the canonical string, computed independently", async () => {
    // The expected value comes from the canonical string put through Node's
    // own crypto, not through the function under test.
    const { createHash } = await import("node:crypto");
    const expected = createHash("sha256")
      .update(canonicalForm(unit(A)), "utf8")
      .digest("hex");
    expect(await hashConfiguration(unit(A))).toBe(expected);
  });
});
