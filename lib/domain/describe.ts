/**
 * A sentence describing a configuration.
 *
 * It is the canvas's text alternative, so it is written to be read aloud: the
 * size, the finish, what the unit holds, and where the support is if it has
 * one. The server owns it so that the description, the price and the geometry
 * cannot disagree.
 */
import { FINISH_SPECS, LIMITS, MODULES } from "@/lib/domain/catalogue";
import {
  MODULE_TYPES,
  centreSupportColumn,
  type Configuration,
  type ModuleType,
} from "@/lib/domain/grid";

const PLURAL: Readonly<Record<ModuleType, string>> = {
  SHELF: "open shelves",
  DRAWER: "drawers",
  DOOR: "doors",
};

const SINGULAR: Readonly<Record<ModuleType, string>> = {
  SHELF: "open shelf",
  DRAWER: "drawer",
  DOOR: "door",
};

function list(parts: readonly string[]): string {
  if (parts.length === 0) {
    return "nothing";
  }
  if (parts.length === 1) {
    return parts[0] ?? "nothing";
  }
  const last = parts[parts.length - 1] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${last}`;
}

export function describeConfiguration(configuration: Configuration): string {
  const { width, height, finish, modules } = configuration;
  const contents = MODULE_TYPES.flatMap((type) => {
    const count = modules.filter((placed) => placed.type === type).length;
    if (count === 0) {
      return [];
    }
    return [`${String(count)} ${count === 1 ? SINGULAR[type] : PLURAL[type]}`];
  });

  const cells = width * height;
  const used = modules.reduce(
    (total, placed) => total + MODULES[placed.type].cells,
    0,
  );
  const reserved = width > LIMITS.maxWidthWithoutSupport ? 1 : 0;
  const empty = cells - used - reserved;

  const sentences = [
    `A ${String(width)}-column, ${String(height)}-row unit in ${FINISH_SPECS[finish].label.toLowerCase()}, holding ${list(contents)}.`,
  ];

  if (empty > 0) {
    sentences.push(
      `${String(empty)} ${empty === 1 ? "bay is" : "bays are"} left open.`,
    );
  }

  if (reserved === 1) {
    sentences.push(
      `A centre support stands in column ${String(centreSupportColumn(width) + 1)} of the bottom row.`,
    );
  }

  return sentences.join(" ");
}
