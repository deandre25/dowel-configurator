"use client";

/**
 * The configurator.
 *
 * The one rule this component obeys above all others: **it does not know what
 * anything costs and does not decide what is legal.** It holds a
 * configuration, sends it to the server after every change, and renders what
 * comes back — a price, or the rules the unit breaks and the bays they are
 * about. There is no local price anywhere in this file, and the `Invalid`
 * branch is the server's answer, not a guess made before asking.
 *
 * Requests are sequenced rather than merely debounced: a reply for a
 * configuration the visitor has already moved on from is dropped, so a slow
 * network cannot put a stale price on screen.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Cell, Configuration, Finish, ModuleType } from "@/lib/domain/grid";
import { cellKey } from "@/lib/domain/grid";
import {
  reduce,
  toInput,
  type Action,
} from "@/lib/configurator/state";
import { request, GraphQLRequestError } from "@/lib/graphql/client";
import {
  PriceConfiguration,
  SaveConfiguration,
} from "@/lib/graphql/operations";
import type {
  PriceFieldsFragment,
  ViolationFieldsFragment,
} from "@/lib/graphql/generated/client/graphql";
import type { Catalogue } from "@/lib/graphql/generated/types";
import { CellTable, type CellViolation } from "@/components/configurator/CellTable";
import { Controls } from "@/components/configurator/Controls";
import { PricePanel } from "@/components/configurator/PricePanel";
import { SceneView } from "@/components/scene/SceneView";

/** How long to wait after a change before asking the server. */
const SETTLE_MS = 220;

type Priced = {
  readonly price: PriceFieldsFragment | null;
  readonly violations: readonly ViolationFieldsFragment[];
  readonly description: string | null;
};

const NOTHING_YET: Priced = {
  price: null,
  violations: [],
  description: null,
};

type ConfiguratorProps = {
  readonly catalogue: Catalogue;
  readonly initialConfiguration: Configuration;
  /** The share id this build was restored from, if it was. */
  readonly restoredFrom?: string;
};

export function Configurator({
  catalogue,
  initialConfiguration,
  restoredFrom,
}: ConfiguratorProps): React.ReactElement {
  const [configuration, dispatch] = useReducer(reduce, initialConfiguration);

  /**
   * The server's answer, together with the configuration it is an answer to.
   *
   * Keeping the two together is what makes "is this price current?" a question
   * about the data rather than a flag someone has to remember to set: the
   * reducer returns a new object for every change, so an answer is stale
   * exactly when its `source` is not the configuration on screen.
   */
  const [answer, setAnswer] = useState<{
    readonly source: Configuration;
    readonly priced: Priced;
  } | null>(null);
  const [failure, setFailure] = useState<{
    readonly source: Configuration;
    readonly message: string;
  } | null>(null);

  const settled =
    answer !== null && answer.source === configuration
      ? answer.priced
      : failure !== null && failure.source === configuration
        ? NOTHING_YET
        : null;
  const pending = settled === null;
  // While a request is in flight the last price stays on screen, marked busy,
  // rather than the panel emptying on every keystroke.
  const priced = answer?.priced ?? NOTHING_YET;
  const currentFailure =
    failure !== null && failure.source === configuration
      ? failure.message
      : null;

  const [shareId, setShareId] = useState<string | null>(restoredFrom ?? null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Only the newest request may write to the screen.
  const latest = useRef(0);

  useEffect(() => {
    const ticket = latest.current + 1;
    latest.current = ticket;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await request(PriceConfiguration, {
            input: toInput(configuration),
          });
          if (latest.current !== ticket) {
            return;
          }
          const reply = result.priceConfiguration;
          setFailure(null);
          setAnswer({
            source: configuration,
            priced:
              reply.__typename === "PricedConfiguration"
                ? {
                    price: reply.price,
                    violations: [],
                    description: reply.configuration.description,
                  }
                : {
                    price: null,
                    violations: reply.violations,
                    description: null,
                  },
          });
        } catch (error) {
          if (latest.current !== ticket) {
            return;
          }
          setFailure({
            source: configuration,
            message:
              error instanceof GraphQLRequestError
                ? "The price could not be fetched. The configuration is unchanged; try again in a moment."
                : "Something went wrong reaching the server.",
          });
        }
      })();
    }, SETTLE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [configuration]);

  // A change invalidates the saved link: it is a link to a different unit.
  const act = useCallback((action: Action) => {
    setShareId(null);
    setCopied(false);
    dispatch(action);
  }, []);

  const onSetCell = useCallback(
    (cell: Cell, module: ModuleType | null) => {
      act({ type: "setCell", cell, module });
    },
    [act],
  );

  const violationsByCell = useMemo(() => {
    const map = new Map<string, CellViolation>();
    for (const violation of priced.violations) {
      for (const cell of violation.cells) {
        map.set(cellKey(cell), {
          code: violation.code,
          message: violation.message,
        });
      }
    }
    return map;
  }, [priced.violations]);

  /** Violations with no bay to sit beside — about the unit as a whole. */
  const generalViolations = priced.violations.filter(
    (violation) => violation.cells.length === 0,
  );

  const save = useCallback(() => {
    setSaving(true);
    void (async () => {
      try {
        const result = await request(SaveConfiguration, {
          input: toInput(configuration),
        });
        const reply = result.saveConfiguration;
        if (reply.__typename === "SavedConfiguration") {
          setShareId(reply.id);
          setFailure(null);
        } else {
          // The server refused the save. Its reasons replace whatever the
          // pricing call last said about this configuration.
          setAnswer({
            source: configuration,
            priced: {
              price: null,
              violations: reply.violations,
              description: null,
            },
          });
        }
      } catch (error) {
        setFailure({
          source: configuration,
          message:
            error instanceof GraphQLRequestError
              ? error.message
              : "The configuration could not be saved.",
        });
      } finally {
        setSaving(false);
      }
    })();
  }, [configuration]);

  const shareUrl =
    shareId === null
      ? null
      : `${typeof window === "undefined" ? "" : window.location.origin}/u/${shareId}`;

  const copy = useCallback(() => {
    if (shareUrl === null) {
      return;
    }
    void navigator.clipboard.writeText(shareUrl).then(
      () => {
        setCopied(true);
      },
      () => {
        // Clipboard permission can be refused; the link is on screen anyway.
        setCopied(false);
      },
    );
  }, [shareUrl]);

  /**
   * What a screen reader is told when the answer changes.
   *
   * One region for the price and the rules together, because they are the same
   * news: what the server said about this configuration. It stays empty while
   * a request is in flight, so a sequence of keystrokes does not produce a
   * sequence of announcements about configurations already abandoned.
   */
  const announcement = ((): string => {
    if (currentFailure !== null) {
      return currentFailure;
    }
    if (settled === null) {
      return "";
    }
    if (settled.price !== null) {
      const total = new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: settled.price.currency,
      }).format(settled.price.totalCents / 100);
      return `Price ${total}. ${settled.description ?? ""}`;
    }
    if (settled.violations.length === 0) {
      return "";
    }
    return `This unit cannot be built. ${settled.violations
      .map((violation) => violation.message)
      .join(" ")}`;
  })();

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0">
        <SceneView
          configuration={configuration}
          description={
            priced.description ??
            "The unit is being priced; its description follows."
          }
        />

        <h2 className="mt-8 text-lg font-semibold tracking-tight">The bays</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Choose what goes in each bay. The view above shows the same unit; it
          is not needed to build one.
        </p>

        <div className="mt-4 overflow-x-auto">
          <CellTable
            configuration={configuration}
            modules={catalogue.modules}
            violations={violationsByCell}
            onSetCell={onSetCell}
          />
        </div>

        {generalViolations.length === 0 ? null : (
          <ul className="mt-4 space-y-1">
            {generalViolations.map((violation) => (
              <li
                key={violation.code}
                className="text-sm text-[color:var(--dowel-warning)]"
              >
                {violation.message}
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-10 text-lg font-semibold tracking-tight">
          Size and finish
        </h2>
        <div className="mt-4">
          <Controls
            configuration={configuration}
            catalogue={catalogue}
            onSetWidth={(width) => {
              act({ type: "setWidth", width });
            }}
            onSetHeight={(height) => {
              act({ type: "setHeight", height });
            }}
            onSetFinish={(finish: Finish) => {
              act({ type: "setFinish", finish });
            }}
          />
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <h2 className="text-lg font-semibold tracking-tight">Price</h2>
        <div className="mt-3">
          <PricePanel
            price={priced.price}
            pending={pending}
            invalid={priced.violations.length > 0}
          />
        </div>

        {currentFailure === null ? null : (
          <p className="mt-4 rounded-md border border-[color:var(--dowel-warning)] px-3 py-2 text-sm">
            {currentFailure}
          </p>
        )}

        <h2 className="mt-8 text-lg font-semibold tracking-tight">Share</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Saving gives this build a link. The same build always gets the same
          link.
        </p>

        <button
          type="button"
          onClick={save}
          disabled={saving || priced.price === null}
          className="mt-3 w-full rounded-md border border-ink bg-ink px-3 py-2 text-sm text-page disabled:cursor-not-allowed disabled:border-line disabled:bg-surface disabled:text-ink-muted"
        >
          {saving ? "Saving…" : "Save this build"}
        </button>

        {shareUrl === null ? null : (
          <div className="mt-3">
            <label className="block text-sm" htmlFor="share-link">
              Link to this build
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="share-link"
                readOnly
                value={shareUrl}
                className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={copy}
                className="shrink-0 rounded-md border border-line px-3 py-1.5 text-sm"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </aside>

      {/*
        One live region for both the price and the rules, because they are the
        same news: what the server said about this configuration. Polite, so it
        waits for a pause rather than interrupting a keystroke.
      */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
