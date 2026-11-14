import type { Metadata } from "next";
import Link from "next/link";
import { ConfiguratorMount } from "@/components/configurator/ConfiguratorMount";
import { createContext } from "@/lib/graphql/context";
import { loadSavedConfiguration } from "@/lib/server/savedConfiguration";

const GENERIC: Metadata = {
  title: "Dowel — a shared build",
  description: "A shelving unit someone configured, restored from its link.",
};

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * The share preview describes the build, not the site.
 *
 * This route exists so that a link can be sent to someone, and a link whose
 * preview carries the site's generic blurb wastes the thing it was made for.
 * The body of the page is a client island and cannot have metadata by
 * construction — but metadata is not the body, and everything needed is
 * already on the server.
 *
 * It reads through `loadSavedConfiguration`, the same function
 * `Query.configuration` resolves through: the same parse, the same
 * re-validation, the same pricing. The preview therefore cannot describe a
 * different unit from the page it links to, and the sentence it uses is the
 * one generated from the configuration the geometry is built from.
 *
 * A row that cannot be read throws — that is right for a query and wrong for
 * a preview, so here it falls back to describing the site. A broken link
 * should be a dull preview, not a failed page.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const saved = await loadSavedConfiguration(createContext(), id);
    if (saved === null) {
      return GENERIC;
    }

    const { configuration, price } = saved;
    const total = money(price.totalCents, price.currency);
    const title = `A ${String(configuration.width)} × ${String(
      configuration.height,
    )} shelving unit, ${total} — Dowel`;
    const description = `${configuration.description} ${total}, priced by the server. Open it to change anything.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        siteName: "Dowel",
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  } catch {
    // An unreadable row is not worth failing a page over.
    return GENERIC;
  }
}

/**
 * A share link. The configurator opens on the saved build rather than waiting
 * to be asked: following the link is the asking.
 *
 * The id is handed straight to the client, which fetches the build through the
 * same typed query the rest of the interface uses. A malformed or unknown id
 * is not an error — the server answers null, and the page says so and offers
 * a unit to start from.
 */
export default async function SharedBuildPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-baseline gap-3 px-5 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Dowel
          </Link>
          <span className="text-sm text-ink-muted">Modular shelving</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">A shared build</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          This is someone&rsquo;s saved unit. Change anything and it becomes
          yours to save in turn.
        </p>

        <div className="mt-8">
          <ConfiguratorMount shareId={id} />
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-6 text-sm text-ink-muted">
          <p>
            Dowel is a fictional company. This is a demonstration project, and
            nothing here is for sale.
          </p>
        </div>
      </footer>
    </>
  );
}
