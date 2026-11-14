"use client";

/**
 * The control surface. The canvas is a view of this, not the other way round.
 *
 * It is a real table: a row per shelf row, a column per bay, and a `select` in
 * each cell. Everything a visitor can do to a unit can be done here with a
 * keyboard alone, and a screen reader is given the grid's structure rather
 * than a description of a picture.
 *
 * Rows are rendered top first, because that is how a table reads and how a
 * shelving unit is looked at. The domain counts rows from the floor, so the
 * mapping happens here and nowhere else.
 */
import { useId } from "react";
import type { Catalogue } from "@/lib/graphql/generated/types";
import type { Cell, Configuration, ModuleType } from "@/lib/domain/grid";
import { occupancy, reservedCell } from "@/lib/configurator/state";

export type CellViolation = {
  readonly code: string;
  readonly message: string;
};

type CellTableProps = {
  readonly configuration: Configuration;
  readonly modules: Catalogue["modules"];
  /** Keyed by `column,row`. */
  readonly violations: ReadonlyMap<string, CellViolation>;
  readonly onSetCell: (cell: Cell, module: ModuleType | null) => void;
};

const EMPTY = "EMPTY";

export function CellTable({
  configuration,
  modules,
  violations,
  onSetCell,
}: CellTableProps): React.ReactElement {
  const tableId = useId();
  const covered = occupancy(configuration);
  const reserved = reservedCell(configuration.width);

  // Top row first.
  const rows = Array.from(
    { length: configuration.height },
    (_, index) => configuration.height - 1 - index,
  );
  const columns = Array.from(
    { length: configuration.width },
    (_, index) => index,
  );

  return (
    <table className="w-full border-collapse text-sm" id={tableId}>
      <caption className="sr-only">
        The bays of the unit. Each bay holds one module or is left open. Rows
        are listed from the top down.
      </caption>
      <thead>
        <tr>
          <th scope="col" className="p-1 text-left font-medium text-ink-muted">
            <span className="sr-only">Row</span>
          </th>
          {columns.map((column) => (
            <th
              key={column}
              scope="col"
              className="p-1 text-left font-medium text-ink-muted"
            >
              Column {column + 1}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row}>
            <th
              scope="row"
              className="whitespace-nowrap p-1 text-left font-medium text-ink-muted"
            >
              {row === configuration.height - 1
                ? "Top row"
                : row === 0
                  ? "Bottom row"
                  : `Row ${row + 1}`}
            </th>

            {columns.map((column) => {
              const cell: Cell = { column, row };
              const key = `${String(column)},${String(row)}`;
              const here = covered.get(key);
              const isDoorTop = here !== undefined && !here.isAnchor;
              const isReserved =
                reserved !== null &&
                reserved.column === column &&
                reserved.row === row;
              const violation = violations.get(key);

              const label = `Bay in column ${String(column + 1)}, ${
                row === configuration.height - 1
                  ? "top row"
                  : row === 0
                    ? "bottom row"
                    : `row ${String(row + 1)}`
              }`;

              if (isReserved) {
                return (
                  <td key={column} className="p-1 align-top">
                    <p className="rounded-md border border-dashed border-line px-2 py-1.5 text-ink-muted">
                      Centre support
                      <span className="sr-only">
                        . This bay holds the centre support a unit over{" "}
                        {4} columns wide needs, and cannot hold a module.
                      </span>
                    </p>
                  </td>
                );
              }

              if (isDoorTop) {
                return (
                  <td key={column} className="p-1 align-top">
                    <p className="rounded-md border border-line bg-surface px-2 py-1.5 text-ink-muted">
                      Door, upper half
                      <span className="sr-only">
                        . Part of the door in the bay below. Change that bay to
                        remove it.
                      </span>
                    </p>
                  </td>
                );
              }

              return (
                <td key={column} className="p-1 align-top">
                  <label className="block">
                    <span className="sr-only">{label}</span>
                    <select
                      className={`w-full rounded-md border bg-surface px-2 py-1.5 ${
                        violation === undefined
                          ? "border-line"
                          : "border-[color:var(--dowel-warning)]"
                      }`}
                      value={here?.module.type ?? EMPTY}
                      aria-describedby={
                        violation === undefined
                          ? undefined
                          : `${tableId}-violation-${key}`
                      }
                      aria-invalid={violation === undefined ? undefined : true}
                      onChange={(event) => {
                        const chosen = event.target.value;
                        onSetCell(
                          cell,
                          chosen === EMPTY ? null : (chosen as ModuleType),
                        );
                      }}
                    >
                      <option value={EMPTY}>Open bay</option>
                      {modules.map((module) => (
                        <option key={module.type} value={module.type}>
                          {module.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {violation === undefined ? null : (
                    <p
                      id={`${tableId}-violation-${key}`}
                      className="mt-1 text-xs text-[color:var(--dowel-warning)]"
                    >
                      {violation.message}
                    </p>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
