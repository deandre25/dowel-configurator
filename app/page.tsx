export default function HomePage() {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-baseline gap-3 px-5 py-4">
          <span className="text-lg font-semibold tracking-tight">Dowel</span>
          <span className="text-sm text-ink-muted">Modular shelving</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12">
        <h1 className="max-w-xl text-3xl font-semibold tracking-tight">
          Build a shelving unit to the size of the wall you have
        </h1>
        <p className="mt-4 max-w-xl text-ink-muted">
          Choose a width and height, fill the grid with shelves, drawers and
          doors, and see the price as you go. The configurator opens next.
        </p>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-6 text-sm text-ink-muted">
          <p>
            Dowel is a fictional company. This is a demonstration project, and
            nothing here is for sale.
          </p>
        </div>
      </footer>
    </>
  );
}
