"use client";

/**
 * The price, exactly as the server sent it.
 *
 * Nothing here computes anything: the totals, the lines and the multiplier all
 * arrive from `priceConfiguration`. The only arithmetic is dividing pence by a
 * hundred to print them, and that is formatting rather than pricing.
 */
import type { PriceFieldsFragment } from "@/lib/graphql/generated/client/graphql";

type PricePanelProps = {
  readonly price: PriceFieldsFragment | null;
  readonly pending: boolean;
  readonly invalid: boolean;
};

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function PricePanel({
  price,
  pending,
  invalid,
}: PricePanelProps): React.ReactElement {
  if (price === null) {
    return (
      <p className="text-ink-muted">
        {invalid
          ? "This unit cannot be built as it stands, so it has no price."
          : "Working out the price…"}
      </p>
    );
  }

  return (
    <div aria-busy={pending}>
      <p className="text-3xl font-semibold tracking-tight">
        {/*
          The figure alone is ambiguous read aloud — the same amount appears
          again as the subtotal and on the finish line — so it is named.
        */}
        <span className="sr-only">Total price: </span>
        {money(price.totalCents, price.currency)}
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        Priced by the server, including the finish.
      </p>

      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">What makes up the price</caption>
        <thead>
          <tr className="text-ink-muted">
            <th scope="col" className="py-1 text-left font-medium">
              Item
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Quantity
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {price.lines.map((line) => (
            <tr key={line.label} className="border-t border-line">
              <th scope="row" className="py-1.5 text-left font-normal">
                {line.label}
              </th>
              <td className="py-1.5 text-right tabular-nums">
                {line.quantity}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {money(line.totalCents, price.currency)}
              </td>
            </tr>
          ))}
          <tr className="border-t border-line">
            <th scope="row" className="py-1.5 text-left font-normal">
              Subtotal
            </th>
            <td />
            <td className="py-1.5 text-right tabular-nums">
              {money(price.subtotalCents, price.currency)}
            </td>
          </tr>
          <tr className="border-t border-line">
            <th scope="row" className="py-1.5 text-left font-normal">
              Finish
            </th>
            <td className="py-1.5 text-right tabular-nums text-ink-muted">
              ×{(price.finishMultiplierBasisPoints / 10_000).toFixed(2)}
            </td>
            <td className="py-1.5 text-right font-medium tabular-nums">
              {money(price.totalCents, price.currency)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
