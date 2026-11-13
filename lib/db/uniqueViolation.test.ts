import { describe, expect, it } from "vitest";
import { isUniqueViolation, violatedUniqueKey } from "@/lib/db/uniqueViolation";

/**
 * Both shapes below were captured from a real Postgres by forcing each
 * violation through the Prisma client this project uses. They are not
 * invented: the reason this module exists is that the shape was not what the
 * documentation led me to expect.
 */
const DUPLICATE_ID_WITH_PG_ADAPTER = {
  code: "P2002",
  meta: {
    driverAdapterError: {
      name: "DriverAdapterError",
      cause: {
        originalCode: "23505",
        originalMessage:
          'duplicate key value violates unique constraint "Configuration_pkey"',
        kind: "UniqueConstraintViolation",
        constraint: { index: "Configuration_pkey" },
        table: "Configuration",
      },
    },
    modelName: "Configuration",
  },
};

const DUPLICATE_HASH_WITH_PG_ADAPTER = {
  code: "P2002",
  meta: {
    driverAdapterError: {
      name: "DriverAdapterError",
      cause: {
        originalCode: "23505",
        originalMessage:
          'duplicate key value violates unique constraint "Configuration_hash_key"',
        kind: "UniqueConstraintViolation",
        constraint: { index: "Configuration_hash_key" },
        table: "Configuration",
      },
    },
    modelName: "Configuration",
  },
};

/** The shape Prisma's own engine reports, which other setups still produce. */
const DUPLICATE_HASH_WITH_META_TARGET = {
  code: "P2002",
  meta: { target: ["hash"], modelName: "Configuration" },
};

const DUPLICATE_ID_WITH_META_TARGET = {
  code: "P2002",
  meta: { target: ["id"], modelName: "Configuration" },
};

describe("violatedUniqueKey", () => {
  it("reads the constraint name the pg driver adapter reports", () => {
    expect(violatedUniqueKey(DUPLICATE_ID_WITH_PG_ADAPTER)).toBe("id");
    expect(violatedUniqueKey(DUPLICATE_HASH_WITH_PG_ADAPTER)).toBe("hash");
  });

  it("reads meta.target when it is present", () => {
    expect(violatedUniqueKey(DUPLICATE_ID_WITH_META_TARGET)).toBe("id");
    expect(violatedUniqueKey(DUPLICATE_HASH_WITH_META_TARGET)).toBe("hash");
  });

  it("returns null for an unrecognised constraint rather than guessing", () => {
    expect(
      violatedUniqueKey({
        code: "P2002",
        meta: { target: ["something_else"] },
      }),
    ).toBeNull();
    expect(violatedUniqueKey({ code: "P2002" })).toBeNull();
    expect(violatedUniqueKey({ code: "P2002", meta: {} })).toBeNull();
  });

  it("returns null for anything that is not a unique violation", () => {
    expect(violatedUniqueKey(new Error("connection refused"))).toBeNull();
    expect(violatedUniqueKey({ code: "P2025" })).toBeNull();
    expect(violatedUniqueKey(undefined)).toBeNull();
    expect(violatedUniqueKey("P2002")).toBeNull();
  });
});

describe("isUniqueViolation", () => {
  it("is true only for P2002", () => {
    expect(isUniqueViolation(DUPLICATE_ID_WITH_PG_ADAPTER)).toBe(true);
    expect(isUniqueViolation({ code: "P2003" })).toBe(false);
    expect(isUniqueViolation(new Error("nope"))).toBe(false);
  });
});
