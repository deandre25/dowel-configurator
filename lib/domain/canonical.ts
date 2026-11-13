/**
 * The canonical form of a configuration, and its hash.
 *
 * Two visitors who assemble the same unit have built the same thing, whatever
 * order they placed the modules in. The canonical form makes that identity
 * explicit: dimensions, finish, and the modules sorted, as one string. The hash
 * of that string is the unique key on the table, so saving the same build twice
 * returns the same share link instead of writing another row.
 */
import type { Configuration, PlacedModule } from "@/lib/domain/grid";

function compareModules(a: PlacedModule, b: PlacedModule): number {
  if (a.column !== b.column) {
    return a.column - b.column;
  }
  if (a.row !== b.row) {
    return a.row - b.row;
  }
  return a.type.localeCompare(b.type);
}

/**
 * A stable string for a configuration. The format is part of the stored data:
 * changing it changes every hash, so it is versioned. Bump `v1` and the
 * existing rows keep their links and simply stop deduplicating against new
 * ones.
 */
export function canonicalForm(configuration: Configuration): string {
  const modules = [...configuration.modules]
    .sort(compareModules)
    .map((placed) => `${placed.type}@${String(placed.column)},${String(placed.row)}`)
    .join("|");
  return [
    "v1",
    `${String(configuration.width)}x${String(configuration.height)}`,
    configuration.finish,
    modules,
  ].join(";");
}

/** SHA-256 of the canonical form, lower-case hex. */
export async function hashConfiguration(
  configuration: Configuration,
): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalForm(configuration));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
