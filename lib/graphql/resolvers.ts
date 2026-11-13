/**
 * The resolvers. Every one of them validates before it does anything else.
 *
 * The server is the authority: an invalid configuration is rejected here, in a
 * typed result the interface can render, whatever the client believed when it
 * sent it. A client that skips the interface entirely and posts the mutation
 * gets the same answer.
 */
import { GraphQLError } from "graphql";
import { HashAlreadyTaken, IdAlreadyTaken } from "@/lib/db/configurationStore";
import type { StoredConfiguration } from "@/lib/db/configurationStore";
import { hashConfiguration } from "@/lib/domain/canonical";
import type { Configuration as DomainConfiguration } from "@/lib/domain/grid";
import { priceConfiguration } from "@/lib/domain/pricing";
import { validateConfiguration } from "@/lib/domain/rules";
import { newShareId, normaliseShareId } from "@/lib/domain/shareId";
import { parseStoredModules } from "@/lib/domain/stored";
import type {
  ConfigurationInput,
  Resolvers,
  SavedConfiguration,
} from "@/lib/graphql/generated/types";
import {
  toCatalogue,
  toConfiguration,
  toInvalidConfiguration,
  toPrice,
} from "@/lib/graphql/present";
import { SCHEMA_VERSION } from "@/lib/graphql/version";

/** How many times a save retries when a random share id is already taken. */
const ID_ATTEMPTS = 5;

/**
 * An absolute ceiling on stored configurations.
 *
 * `saveConfiguration` is a public write with no account behind it, against a
 * 0.5 GB database. The content hash already means a repeated request writes
 * nothing, so this bounds the one case the hash does not: a script that walks
 * distinct configurations. A row is a few hundred bytes, so 50,000 of them is
 * a few tens of megabytes — well inside the tier, and far more builds than a
 * portfolio piece will ever hold.
 *
 * It is checked only on the path that would write a new row, so saving a build
 * that already exists keeps working after the ceiling is reached.
 */
const MAX_SAVED_CONFIGURATIONS = 50_000;

function fromInput(input: ConfigurationInput): DomainConfiguration {
  return {
    width: input.width,
    height: input.height,
    finish: input.finish,
    modules: input.modules.map((module) => ({
      type: module.type,
      column: module.column,
      row: module.row,
    })),
  };
}

function toSavedConfiguration(row: StoredConfiguration): SavedConfiguration {
  const modules = parseStoredModules(row.modules);
  if (modules === null) {
    // Not an invalid configuration the visitor can fix — a row this build
    // cannot read. A GraphQL error, because something actually went wrong.
    throw new GraphQLError("A saved configuration could not be read.", {
      extensions: { code: "UNREADABLE_CONFIGURATION", id: row.id },
    });
  }

  const configuration: DomainConfiguration = {
    width: row.width,
    height: row.height,
    finish: row.finish,
    modules,
  };

  // Validated on read as well as on write: a row could have been written by an
  // older build or edited by hand, and a configuration that breaks a rule must
  // not be priced as though it were legal.
  const validation = validateConfiguration(configuration);
  if (!validation.valid) {
    throw new GraphQLError("A saved configuration is no longer valid.", {
      extensions: {
        code: "STORED_CONFIGURATION_INVALID",
        id: row.id,
        violations: validation.violations.map((violation) => violation.code),
      },
    });
  }

  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    configuration: toConfiguration(configuration),
    price: toPrice(priceConfiguration(configuration)),
  };
}

export const resolvers: Resolvers = {
  Query: {
    catalogue: () => toCatalogue(),

    configuration: async (_parent, args, context) => {
      const id = normaliseShareId(args.id);
      if (id === null) {
        // A malformed id is a miss, not an error, and never becomes a query.
        return null;
      }
      const row = await context.store().find(id);
      return row === null ? null : toSavedConfiguration(row);
    },

    health: async (_parent, _args, context) => ({
      ok: true,
      database: await context.pingDatabase(),
      schemaVersion: SCHEMA_VERSION,
    }),
  },

  Mutation: {
    priceConfiguration: (_parent, args) => {
      const configuration = fromInput(args.input);
      const validation = validateConfiguration(configuration);
      if (!validation.valid) {
        return toInvalidConfiguration(validation.violations);
      }
      return {
        configuration: toConfiguration(configuration),
        price: toPrice(priceConfiguration(configuration)),
      };
    },

    saveConfiguration: async (_parent, args, context) => {
      const configuration = fromInput(args.input);
      const validation = validateConfiguration(configuration);
      if (!validation.valid) {
        return toInvalidConfiguration(validation.violations);
      }

      const store = context.store();
      const hash = await hashConfiguration(configuration);

      // The same build always yields the same link. This is the better
      // behaviour on its own terms, and it is also what keeps a public write
      // from filling the database with repeats.
      const existing = await store.findByHash(hash);
      if (existing !== null) {
        return toSavedConfiguration(existing);
      }

      if ((await store.count()) >= MAX_SAVED_CONFIGURATIONS) {
        throw new GraphQLError(
          "This demonstration is not accepting new configurations.",
          { extensions: { code: "SAVE_LIMIT_REACHED" } },
        );
      }

      for (let attempt = 1; attempt <= ID_ATTEMPTS; attempt += 1) {
        try {
          const row = await store.create({
            id: newShareId(),
            hash,
            width: configuration.width,
            height: configuration.height,
            finish: configuration.finish,
            modules: configuration.modules,
          });
          return toSavedConfiguration(row);
        } catch (error) {
          if (error instanceof HashAlreadyTaken) {
            // Another request saved this build between the lookup above and
            // this write. Its row is the answer.
            const raced = await store.findByHash(hash);
            if (raced !== null) {
              return toSavedConfiguration(raced);
            }
            throw error;
          }
          if (!(error instanceof IdAlreadyTaken)) {
            throw error;
          }
          if (attempt === ID_ATTEMPTS) {
            // Out of attempts. A typed GraphQL error rather than the store's
            // own exception: the client learns that saving failed and can
            // retry, and the reason does not leak the storage layer.
            throw new GraphQLError("Could not allocate a share id.", {
              extensions: { code: "ID_ALLOCATION_FAILED", attempts: attempt },
            });
          }
        }
      }
      // Unreachable: the loop either returns or throws on its last attempt.
      // Explicit, because a silent undefined here would become a null in a
      // field the schema declares non-null.
      throw new GraphQLError("Could not allocate a share id.", {
        extensions: { code: "ID_ALLOCATION_FAILED" },
      });
    },
  },

  PriceConfigurationResult: {
    __resolveType: (result) =>
      "violations" in result ? "InvalidConfiguration" : "PricedConfiguration",
  },

  SaveConfigurationResult: {
    __resolveType: (result) =>
      "violations" in result ? "InvalidConfiguration" : "SavedConfiguration",
  },
};
