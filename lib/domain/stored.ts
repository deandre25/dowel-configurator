/**
 * Parsing a configuration back out of storage.
 *
 * The `modules` column is JSON, so what comes back is `unknown`. A row could
 * have been written by an older version of this code or edited by hand, and a
 * configuration that fails to parse must not become a confident, wrong answer.
 * These functions return null rather than coercing.
 */
import {
  FINISHES,
  MODULE_TYPES,
  type Finish,
  type ModuleType,
  type PlacedModule,
} from "@/lib/domain/grid";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asModuleType(value: unknown): ModuleType | null {
  return MODULE_TYPES.find((type) => type === value) ?? null;
}

export function asFinish(value: unknown): Finish | null {
  return FINISHES.find((finish) => finish === value) ?? null;
}

function parseModule(value: unknown): PlacedModule | null {
  if (!isRecord(value)) {
    return null;
  }
  const type = asModuleType(value["type"]);
  const column = value["column"];
  const row = value["row"];
  if (
    type === null ||
    typeof column !== "number" ||
    typeof row !== "number" ||
    !Number.isInteger(column) ||
    !Number.isInteger(row)
  ) {
    return null;
  }
  return { type, column, row };
}

/** Returns null if any element fails to parse, never a partial list. */
export function parseStoredModules(value: unknown): PlacedModule[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const modules: PlacedModule[] = [];
  for (const element of value) {
    const parsed = parseModule(element);
    if (parsed === null) {
      return null;
    }
    modules.push(parsed);
  }
  return modules;
}

/** The shape written to the `modules` column. */
export function toStoredModules(
  modules: readonly PlacedModule[],
): readonly PlacedModule[] {
  return modules.map(({ type, column, row }) => ({ type, column, row }));
}
