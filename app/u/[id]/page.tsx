import type { Metadata } from "next";
import Link from "next/link";
import { ConfiguratorMount } from "@/components/configurator/ConfiguratorMount";

export const metadata: Metadata = {
  title: "Dowel — a shared build",
  description: "A shelving unit someone configured, restored from its link.",
};

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
