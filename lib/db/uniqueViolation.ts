/**
 * Which unique constraint a Prisma P2002 is about.
 *
 * The table has two unique keys and they mean opposite things to the caller:
 * a duplicate share id should be retried with another id, a duplicate content
 * hash means the build is already saved and its row is the answer. Getting
 * this wrong leaves the retry path dead until the day two random ids collide.
 *
 * Prisma reports the constraint differently depending on how it reached the
 * database. With the `pg` driver adapter there is no `meta.target` at all; the
 * constraint name arrives as
 * `meta.driverAdapterError.cause.constraint.index` — verified against a real
 * Postgres by forcing both violations, with the shapes recorded in
 * `uniqueViolation.test.ts`. `meta.target` is still read, because the engine
 * path and other adapters do set it.
 *
 * An unrecognised constraint returns null, and the caller raises rather than
 * guessing: a wrong guess here is silent and a raise is not.
 */
export const UNIQUE_VIOLATION = "P2002";

export type UniqueKey = "id" | "hash";

function stringsFrom(value: unknown): readonly string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function get(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return (value as Record<string, unknown>)[key];
}

export function isUniqueViolation(error: unknown): boolean {
  return get(error, "code") === UNIQUE_VIOLATION;
}

export function violatedUniqueKey(error: unknown): UniqueKey | null {
  if (!isUniqueViolation(error)) {
    return null;
  }

  const meta = get(error, "meta");
  const cause = get(get(meta, "driverAdapterError"), "cause");
  const candidates = [
    ...stringsFrom(get(meta, "target")),
    ...stringsFrom(get(get(cause, "constraint"), "index")),
    ...stringsFrom(get(cause, "originalMessage")),
  ].map((candidate) => candidate.toLowerCase());

  if (candidates.some((candidate) => candidate.includes("hash"))) {
    return "hash";
  }
  if (
    candidates.some(
      (candidate) => candidate.includes("pkey") || candidate === "id",
    )
  ) {
    return "id";
  }
  return null;
}
