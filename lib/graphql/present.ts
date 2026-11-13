/**
 * Maps domain values onto the shapes the schema declares.
 *
 * It exists so the resolvers stay short and so there is one place where a
 * domain type becomes an API type. The generated types are the target, which
 * means a change to the SDL breaks this file at compile time rather than at
 * run time.
 */
import { CATALOGUE, LIMITS } from "@/lib/domain/catalogue";
import { describeConfiguration } from "@/lib/domain/describe";
import {
  cellsOccupiedBy,
  centreSupportCell,
  type Configuration as DomainConfiguration,
} from "@/lib/domain/grid";
import type { Price as DomainPrice } from "@/lib/domain/pricing";
import type { Violation } from "@/lib/domain/rules";
import type {
  Catalogue,
  Configuration,
  InvalidConfiguration,
  Price,
  RuleViolation,
} from "@/lib/graphql/generated/types";

export function toConfiguration(
  configuration: DomainConfiguration,
): Configuration {
  const needsSupport = configuration.width > LIMITS.maxWidthWithoutSupport;
  return {
    width: configuration.width,
    height: configuration.height,
    finish: configuration.finish,
    modules: configuration.modules.map((placed) => ({
      type: placed.type,
      column: placed.column,
      row: placed.row,
      cells: cellsOccupiedBy(placed).map((cell) => ({
        column: cell.column,
        row: cell.row,
      })),
    })),
    centreSupportCell: needsSupport
      ? centreSupportCell(configuration.width)
      : null,
    description: describeConfiguration(configuration),
  };
}

export function toPrice(price: DomainPrice): Price {
  return {
    currency: price.currency,
    lines: price.lines.map((line) => ({
      label: line.label,
      quantity: line.quantity,
      unitCents: line.unitCents,
      totalCents: line.totalCents,
    })),
    subtotalCents: price.subtotalCents,
    finishMultiplierBasisPoints: price.finishMultiplierBasisPoints,
    totalCents: price.totalCents,
  };
}

export function toViolation(violation: Violation): RuleViolation {
  return {
    code: violation.code,
    message: violation.message,
    cells: violation.cells.map((cell) => ({
      column: cell.column,
      row: cell.row,
    })),
    moduleIndex: violation.moduleIndex,
  };
}

export function toInvalidConfiguration(
  violations: readonly Violation[],
): InvalidConfiguration {
  return { violations: violations.map(toViolation) };
}

export function toCatalogue(): Catalogue {
  return {
    currency: CATALOGUE.currency,
    limits: {
      minWidth: CATALOGUE.limits.minWidth,
      maxWidth: CATALOGUE.limits.maxWidth,
      minHeight: CATALOGUE.limits.minHeight,
      maxHeight: CATALOGUE.limits.maxHeight,
      maxWidthWithoutSupport: CATALOGUE.limits.maxWidthWithoutSupport,
    },
    modules: CATALOGUE.modules.map((spec) => ({
      type: spec.type,
      label: spec.label,
      description: spec.description,
      cells: spec.cells,
      priceCents: spec.priceCents,
    })),
    finishes: CATALOGUE.finishes.map((spec) => ({
      finish: spec.finish,
      label: spec.label,
      description: spec.description,
      multiplierBasisPoints: spec.multiplierBasisPoints,
    })),
    frameBaseCents: CATALOGUE.frameBaseCents,
    perCellCents: CATALOGUE.perCellCents,
  };
}
