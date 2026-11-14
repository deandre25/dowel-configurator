"use client";

/**
 * The lazy boundary.
 *
 * Everything below this line — the configurator, the typed client, Three.js,
 * R3F, drei and the environment map — is behind a dynamic import that does not
 * begin until the visitor asks for it, or until the page is a share link,
 * where they have already asked by following it.
 *
 * The landing route itself stays a server component, so a visitor who reads
 * the page and leaves downloads none of this. That was decided before any of
 * it was written, because it is a decision about page composition and
 * retrofitting it means rewriting the page.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Configuration } from "@/lib/domain/grid";
import { STARTING_CONFIGURATION } from "@/lib/configurator/state";
import { request, GraphQLRequestError } from "@/lib/graphql/client";
import {
  CataloguePage,
  RestoreConfiguration,
} from "@/lib/graphql/operations";
import type { Catalogue } from "@/lib/graphql/generated/types";

const Configurator = dynamic(
  async () => {
    const loaded = await import("@/components/configurator/Configurator");
    return loaded.Configurator;
  },
  {
    ssr: false,
    loading: () => (
      <p className="py-10 text-ink-muted">
        Loading the configurator — the controls, the pricing and the 3D view.
      </p>
    ),
  },
);

type Loaded = {
  readonly catalogue: Catalogue;
  readonly configuration: Configuration;
  readonly restoredFrom?: string;
};

type MountProps = {
  /** When set, the configurator opens straight away on that saved build. */
  readonly shareId?: string;
};

export function ConfiguratorMount({ shareId }: MountProps): React.ReactElement {
  const [wanted, setWanted] = useState(shareId !== undefined);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!wanted) {
      return;
    }
    let current = true;

    void (async () => {
      try {
        const { catalogue } = await request(CataloguePage);

        if (shareId === undefined) {
          if (current) {
            setLoaded({ catalogue, configuration: STARTING_CONFIGURATION });
          }
          return;
        }

        const restored = await request(RestoreConfiguration, { id: shareId });
        if (!current) {
          return;
        }
        const saved = restored.configuration;
        if (saved === null) {
          setFailure(
            "That link does not match a saved build. It may have been mistyped.",
          );
          setLoaded({ catalogue, configuration: STARTING_CONFIGURATION });
          return;
        }
        setLoaded({
          catalogue,
          configuration: {
            width: saved.configuration.width,
            height: saved.configuration.height,
            finish: saved.configuration.finish,
            modules: saved.configuration.modules.map((module) => ({
              type: module.type,
              column: module.column,
              row: module.row,
            })),
          },
          restoredFrom: saved.id,
        });
      } catch (error) {
        if (current) {
          setFailure(
            error instanceof GraphQLRequestError
              ? "The configurator could not reach the server."
              : "The configurator could not be loaded.",
          );
        }
      }
    })();

    return () => {
      current = false;
    };
  }, [wanted, shareId]);

  if (!wanted) {
    return (
      <button
        type="button"
        onClick={() => {
          setWanted(true);
        }}
        className="rounded-md border border-ink bg-ink px-4 py-2.5 text-page"
      >
        Build a unit
      </button>
    );
  }

  if (failure !== null && loaded === null) {
    return (
      <div>
        <p className="text-[color:var(--dowel-warning)]">{failure}</p>
        <button
          type="button"
          onClick={() => {
            setFailure(null);
            setWanted(false);
          }}
          className="mt-3 rounded-md border border-line px-4 py-2 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (loaded === null) {
    return (
      <p className="py-10 text-ink-muted">
        Fetching the catalogue — the sizes, the modules and their prices all
        come from the server.
      </p>
    );
  }

  return (
    <>
      {failure === null ? null : (
        <p className="mb-6 rounded-md border border-[color:var(--dowel-warning)] px-3 py-2 text-sm">
          {failure}
        </p>
      )}
      <Configurator
        catalogue={loaded.catalogue}
        initialConfiguration={loaded.configuration}
        {...(loaded.restoredFrom === undefined
          ? {}
          : { restoredFrom: loaded.restoredFrom })}
      />
    </>
  );
}
