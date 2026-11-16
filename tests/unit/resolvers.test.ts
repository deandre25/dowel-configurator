/**
 * The resolvers, called through the real schema.
 *
 * They go through the Yoga server the route handler builds, over HTTP, rather
 * than calling resolver functions directly: the schema, the enums, the unions,
 * the non-null constraints and the error masking are all exercised, and the
 * response asserted is the one a client would actually receive. Storage is the
 * in-memory implementation; everything else is the code that runs in
 * production.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/domain/catalogue";
import { centreSupportColumn } from "@/lib/domain/grid";
import { RULE_CODES, type RuleCode } from "@/lib/domain/rules";
import { newShareId } from "@/lib/domain/shareId";
import type { GraphQLContext } from "@/lib/graphql/context";
import { GRAPHQL_ENDPOINT, createYogaServer } from "@/lib/graphql/yoga";
import {
  memoryConfigurationStore,
  type MemoryStore,
} from "@/tests/unit/memoryConfigurationStore";

let store: MemoryStore;
let pings: boolean;

function context(): GraphQLContext {
  return { store: () => store, pingDatabase: () => Promise.resolve(pings) };
}

type Response = {
  readonly status: number;
  readonly data?: Record<string, unknown> | null;
  readonly errors?: readonly {
    message: string;
    extensions?: Record<string, unknown>;
  }[];
};

async function run(
  query: string,
  variables?: Record<string, unknown>,
): Promise<Response> {
  const yoga = createYogaServer(context);
  const response = await yoga.fetch(`http://dowel.test${GRAPHQL_ENDPOINT}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body: unknown = await response.json();
  return { status: response.status, ...(body as object) };
}

/** Fails the test with the server's own errors rather than a null-access. */
function dataOf(result: Response): Record<string, unknown> {
  expect(result.errors, JSON.stringify(result.errors)).toBeUndefined();
  expect(result.status).toBe(200);
  expect(result.data).not.toBeNull();
  return result.data ?? {};
}

const PRICE_MUTATION = /* GraphQL */ `
  mutation Price($input: ConfigurationInput!) {
    priceConfiguration(input: $input) {
      __typename
      ... on PricedConfiguration {
        configuration {
          width
          height
          finish
          centreSupportCell {
            column
            row
          }
          description
          modules {
            type
            column
            row
            cells {
              column
              row
            }
          }
        }
        price {
          currency
          subtotalCents
          finishMultiplierBasisPoints
          totalCents
          lines {
            label
            quantity
            unitCents
            totalCents
          }
        }
      }
      ... on InvalidConfiguration {
        violations {
          code
          message
          moduleIndex
          cells {
            column
            row
          }
        }
      }
    }
  }
`;

const SAVE_MUTATION = /* GraphQL */ `
  mutation Save($input: ConfigurationInput!) {
    saveConfiguration(input: $input) {
      __typename
      ... on SavedConfiguration {
        id
        createdAt
        configuration {
          width
          height
          finish
          modules {
            type
            column
            row
          }
        }
        price {
          totalCents
        }
      }
      ... on InvalidConfiguration {
        violations {
          code
        }
      }
    }
  }
`;

const RESTORE_QUERY = /* GraphQL */ `
  query Restore($id: ID!) {
    configuration(id: $id) {
      id
      configuration {
        width
        height
        finish
        modules {
          type
          column
          row
        }
      }
      price {
        totalCents
      }
    }
  }
`;

type Input = {
  width: number;
  height: number;
  finish: "OAK" | "CHARCOAL" | "WHITE";
  modules: readonly { type: string; column: number; row: number }[];
};

const VALID: Input = {
  width: 3,
  height: 3,
  finish: "WHITE",
  modules: [
    { type: "DOOR", column: 0, row: 0 },
    { type: "DRAWER", column: 1, row: 0 },
    { type: "DRAWER", column: 1, row: 1 },
  ],
};

beforeEach(() => {
  store = memoryConfigurationStore();
  pings = true;
});

describe("Query.catalogue", () => {
  it("serves the limits and prices the interface renders from", async () => {
    const data = dataOf(
      await run(/* GraphQL */ `
        {
          catalogue {
            currency
            frameBaseCents
            perCellCents
            limits {
              minWidth
              maxWidth
              minHeight
              maxHeight
              maxWidthWithoutSupport
            }
            modules {
              type
              label
              cells
              priceCents
            }
            finishes {
              finish
              label
              multiplierBasisPoints
            }
          }
        }
      `),
    );

    expect(data["catalogue"]).toMatchObject({
      currency: "GBP",
      frameBaseCents: 17_950,
      perCellCents: 2_175,
      limits: {
        minWidth: LIMITS.minWidth,
        maxWidth: LIMITS.maxWidth,
        minHeight: LIMITS.minHeight,
        maxHeight: LIMITS.maxHeight,
        maxWidthWithoutSupport: LIMITS.maxWidthWithoutSupport,
      },
    });
  });
});

describe("Mutation.priceConfiguration", () => {
  it("prices a valid configuration, and the price matches the pricing table", async () => {
    const data = dataOf(await run(PRICE_MUTATION, { input: VALID }));
    expect(data["priceConfiguration"]).toMatchObject({
      __typename: "PricedConfiguration",
      price: {
        currency: "GBP",
        subtotalCents: 52_710,
        finishMultiplierBasisPoints: 10_500,
        totalCents: 55_346,
      },
    });
  });

  it("returns the cells a door covers, so the client does not work them out", async () => {
    const data = dataOf(await run(PRICE_MUTATION, { input: VALID }));
    const result = data["priceConfiguration"] as {
      configuration: { modules: { type: string; cells: unknown[] }[] };
    };
    const door = result.configuration.modules.find((m) => m.type === "DOOR");
    expect(door?.cells).toEqual([
      { column: 0, row: 0 },
      { column: 0, row: 1 },
    ]);
  });

  it("describes the build in a sentence, for the canvas's text alternative", async () => {
    const data = dataOf(await run(PRICE_MUTATION, { input: VALID }));
    const result = data["priceConfiguration"] as {
      configuration: { description: string };
    };
    expect(result.configuration.description).toBe(
      "A 3-column, 3-row unit in white, holding 2 drawers and 1 door. 5 bays are left open.",
    );
  });

  it("reports where the centre support stands on a wide unit, and null on a narrow one", async () => {
    const wide = dataOf(
      await run(PRICE_MUTATION, {
        input: { ...VALID, width: 5, modules: [{ type: "SHELF", column: 0, row: 0 }] },
      }),
    );
    expect(wide["priceConfiguration"]).toMatchObject({
      configuration: {
        centreSupportCell: { column: centreSupportColumn(5), row: 0 },
      },
    });

    const narrow = dataOf(
      await run(PRICE_MUTATION, {
        input: { ...VALID, width: 3, modules: [{ type: "SHELF", column: 0, row: 0 }] },
      }),
    );
    expect(narrow["priceConfiguration"]).toMatchObject({
      configuration: { centreSupportCell: null },
    });
  });

  it("returns no price at all for an invalid configuration", async () => {
    const data = dataOf(
      await run(PRICE_MUTATION, {
        input: { ...VALID, modules: [{ type: "DRAWER", column: 0, row: 2 }] },
      }),
    );
    const result = data["priceConfiguration"] as Record<string, unknown>;
    expect(result["__typename"]).toBe("InvalidConfiguration");
    expect(result["price"]).toBeUndefined();
  });

  it("rejects each rule with its own code, and says which cell", async () => {
    const samples: Readonly<Record<RuleCode, Input>> = {
      DIMENSIONS_OUT_OF_RANGE: { ...VALID, width: 7 },
      EMPTY_UNIT: { ...VALID, modules: [] },
      OUT_OF_BOUNDS: {
        ...VALID,
        modules: [{ type: "SHELF", column: 9, row: 0 }],
      },
      DRAWER_IN_TOP_ROW: {
        ...VALID,
        modules: [{ type: "DRAWER", column: 0, row: 2 }],
      },
      DOOR_SPANS_TOP_EDGE: {
        ...VALID,
        modules: [{ type: "DOOR", column: 0, row: 2 }],
      },
      CELL_OCCUPIED: {
        ...VALID,
        modules: [
          { type: "SHELF", column: 0, row: 0 },
          { type: "SHELF", column: 0, row: 0 },
        ],
      },
      CELL_RESERVED_FOR_SUPPORT: {
        ...VALID,
        width: 5,
        modules: [{ type: "SHELF", column: centreSupportColumn(5), row: 0 }],
      },
    };

    for (const code of RULE_CODES) {
      const data = dataOf(await run(PRICE_MUTATION, { input: samples[code] }));
      const result = data["priceConfiguration"] as {
        __typename: string;
        violations: { code: string; message: string; cells: unknown[] }[];
      };
      expect(result.__typename, code).toBe("InvalidConfiguration");
      const violation = result.violations.find((v) => v.code === code);
      expect(violation, `expected a ${code} violation`).toBeDefined();
      expect(violation?.message.length).toBeGreaterThan(20);
      if (code !== "EMPTY_UNIT" && code !== "DIMENSIONS_OUT_OF_RANGE") {
        expect(violation?.cells.length, code).toBeGreaterThan(0);
      }
    }
  });
});

describe("Mutation.saveConfiguration and Query.configuration", () => {
  it("round-trips a build through a share id", async () => {
    const saved = dataOf(await run(SAVE_MUTATION, { input: VALID }));
    const result = saved["saveConfiguration"] as {
      __typename: string;
      id: string;
      createdAt: string;
      price: { totalCents: number };
    };
    expect(result.__typename).toBe("SavedConfiguration");
    expect(result.id).toMatch(/^[0-9A-HJ-KM-NP-TV-Z]{8}$/);
    expect(result.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );

    const restored = dataOf(await run(RESTORE_QUERY, { id: result.id }));
    expect(restored["configuration"]).toEqual({
      id: result.id,
      configuration: {
        width: VALID.width,
        height: VALID.height,
        finish: VALID.finish,
        modules: VALID.modules,
      },
      price: { totalCents: result.price.totalCents },
    });
  });

  it("validates on save, so a client that skips the interface is still refused", async () => {
    const data = dataOf(
      await run(SAVE_MUTATION, {
        input: { ...VALID, modules: [{ type: "DRAWER", column: 0, row: 2 }] },
      }),
    );
    expect(data["saveConfiguration"]).toEqual({
      __typename: "InvalidConfiguration",
      violations: [{ code: "DRAWER_IN_TOP_ROW" }],
    });
    expect(store.rows.size).toBe(0);
  });

  it("restores a build from a mistyped link, folding O onto 0 and I onto 1", async () => {
    const saved = dataOf(await run(SAVE_MUTATION, { input: VALID }));
    const { id } = saved["saveConfiguration"] as { id: string };
    const mistyped = id.replaceAll("0", "O").replaceAll("1", "I").toLowerCase();

    const restored = dataOf(await run(RESTORE_QUERY, { id: mistyped }));
    expect(restored["configuration"]).toMatchObject({ id });
  });

  it("answers null for an id that does not exist", async () => {
    const data = dataOf(await run(RESTORE_QUERY, { id: newShareId() }));
    expect(data["configuration"]).toBeNull();
  });

  it("answers null for a malformed id without querying storage", async () => {
    let queried = false;
    const spy: MemoryStore = {
      ...store,
      find: (id) => {
        queried = true;
        return store.find(id);
      },
    };
    store = spy;

    for (const id of ["", "nope", "A1B2C3D$", "'; drop table"]) {
      const data = dataOf(await run(RESTORE_QUERY, { id }));
      expect(data["configuration"], id).toBeNull();
    }
    expect(queried).toBe(false);
  });

  it("retries when a generated id is already taken", async () => {
    store.rejectNextIds(3);
    const data = dataOf(await run(SAVE_MUTATION, { input: VALID }));
    expect(data["saveConfiguration"]).toMatchObject({
      __typename: "SavedConfiguration",
    });
  });

  it("gives up loudly rather than silently when no id can be allocated", async () => {
    store.rejectNextIds(100);
    const result = await run(SAVE_MUTATION, { input: VALID });
    expect(result.errors?.[0]?.extensions?.["code"]).toBe(
      "ID_ALLOCATION_FAILED",
    );
    expect(result.errors?.[0]?.message).toBe("Could not allocate a share id.");
    expect(store.rows.size).toBe(0);
  });
});

describe("a stored row this build cannot trust", () => {
  it("errors rather than guessing when the modules column will not parse", async () => {
    const id = newShareId();
    store.seed({
      id,
      width: 3,
      height: 3,
      finish: "OAK",
      modules: [{ type: "TRAPDOOR", column: 0, row: 0 }],
      createdAt: new Date("2026-11-13T10:00:00.000Z"),
    });

    const result = await run(RESTORE_QUERY, { id });
    expect(result.errors?.[0]?.extensions?.["code"]).toBe(
      "UNREADABLE_CONFIGURATION",
    );
  });

  it("errors rather than pricing a stored configuration that breaks a rule", async () => {
    const id = newShareId();
    store.seed({
      id,
      width: 3,
      height: 3,
      finish: "OAK",
      // A drawer in the top row: writable only by an older build or by hand.
      modules: [{ type: "DRAWER", column: 0, row: 2 }],
      createdAt: new Date("2026-11-13T10:00:00.000Z"),
    });

    const result = await run(RESTORE_QUERY, { id });
    expect(result.errors?.[0]?.extensions?.["code"]).toBe(
      "STORED_CONFIGURATION_INVALID",
    );
    expect(result.errors?.[0]?.extensions?.["violations"]).toEqual([
      "DRAWER_IN_TOP_ROW",
    ]);
  });
});

describe("Query.health", () => {
  it("reports the database separately from the route handler", async () => {
    pings = false;
    const data = dataOf(
      await run(/* GraphQL */ `
        {
          health {
            ok
            database
            schemaVersion
          }
        }
      `),
    );
    expect(data["health"]).toEqual({
      ok: true,
      database: false,
      schemaVersion: "2",
    });
  });
});
