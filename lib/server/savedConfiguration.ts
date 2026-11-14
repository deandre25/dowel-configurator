/**
 * Reading a saved build, for whoever needs it on the server.
 *
 * This is one path with two callers, not two paths: `Query.configuration`
 * resolves through it, and so does the metadata for a share link. The same
 * parse, the same re-validation on read, the same pricing. A share preview
 * cannot describe a different unit from the page it links to, because there is
 * only one function that knows how to read a row.
 *
 * It needs nothing from a request — the context is a store and a ping — so it
 * is callable from a route handler, a resolver or `generateMetadata` alike.
 */
import { GraphQLError } from "graphql";
import type { StoredConfiguration } from "@/lib/db/configurationStore";
import type { Configuration as DomainConfiguration } from "@/lib/domain/grid";
import { priceConfiguration } from "@/lib/domain/pricing";
import { validateConfiguration } from "@/lib/domain/rules";
import { normaliseShareId } from "@/lib/domain/shareId";
import { parseStoredModules } from "@/lib/domain/stored";
import type { GraphQLContext } from "@/lib/graphql/context";
import type { SavedConfiguration } from "@/lib/graphql/generated/types";
import { toConfiguration, toPrice } from "@/lib/graphql/present";

export function toSavedConfiguration(
  row: StoredConfiguration,
): SavedConfiguration {
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

/**
 * The saved build at this id, or null when there is none.
 *
 * A malformed id is a miss rather than an error, and never becomes a database
 * query. A row that cannot be read or no longer passes the rules throws, and
 * the caller decides what that means: the resolver reports it, the metadata
 * falls back to describing the site.
 */
export async function loadSavedConfiguration(
  context: GraphQLContext,
  id: string,
): Promise<SavedConfiguration | null> {
  const normalised = normaliseShareId(id);
  if (normalised === null) {
    return null;
  }
  const row = await context.store().find(normalised);
  return row === null ? null : toSavedConfiguration(row);
}
