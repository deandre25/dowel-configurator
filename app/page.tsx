import { ConfiguratorMount } from "@/components/configurator/ConfiguratorMount";

/**
 * The landing route is a server component and stays one.
 *
 * The only client code it carries is the mount button; the configurator, the
 * GraphQL client and the whole 3D view arrive on the other side of a dynamic
 * import, when the visitor asks for them. Someone who reads this page and
 * leaves downloads none of it.
 */
export default function HomePage(): React.ReactElement {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-baseline gap-3 px-5 py-4">
          <span className="text-lg font-semibold tracking-tight">Dowel</span>
          <span className="text-sm text-ink-muted">Modular shelving</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12">
        <h1 className="max-w-xl text-3xl font-semibold tracking-tight">
          Build a shelving unit to the size of the wall you have
        </h1>
        <p className="mt-4 max-w-xl text-ink-muted">
          Two to six columns, two to five rows, in oak, charcoal or white. Fill
          the bays with shelves, drawers and doors; the price follows as you go,
          and a saved build keeps its link.
        </p>

        <div className="mt-8">
          <ConfiguratorMount />
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
