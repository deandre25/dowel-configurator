import type { Metadata } from "next";
import Link from "next/link";
import { describeConfiguration } from "@/lib/domain/describe";
import { validateConfiguration } from "@/lib/domain/rules";
import {
  EXAMPLES,
  EXAMPLE_LABELS,
  EXAMPLE_NAMES,
  isExampleName,
} from "@/lib/scene/examples";
import { SceneView } from "@/components/scene/SceneView";
import type { CameraPreset } from "@/components/scene/Stage";

export const metadata: Metadata = {
  title: "Dowel — the unit, drawn",
  description:
    "Three example shelving units, assembled from generated geometry.",
};

const VIEWS: readonly CameraPreset[] = ["threeQuarter", "front", "side"];
const VIEW_LABELS: Readonly<Record<CameraPreset, string>> = {
  threeQuarter: "Three-quarter",
  front: "Front",
  side: "Side",
};

function isView(value: string | undefined): value is CameraPreset {
  return VIEWS.some((view) => view === value);
}

type SceneParams = {
  readonly build?: string;
  readonly view?: string;
};

export default async function ScenePage({
  searchParams,
}: {
  searchParams: Promise<SceneParams>;
}): Promise<React.ReactElement> {
  const params = await searchParams;
  const build = isExampleName(params.build) ? params.build : "mixed";
  const view = isView(params.view) ? params.view : "threeQuarter";
  const configuration = EXAMPLES[build];

  // The server draws nothing it has not validated, here as in the resolvers.
  const validation = validateConfiguration(configuration);
  const description = validation.valid
    ? describeConfiguration(configuration)
    : "This configuration is not valid and is not drawn.";

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-baseline gap-3 px-5 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Dowel
          </Link>
          <span className="text-sm text-ink-muted">Modular shelving</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">The unit</h1>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Every panel here is generated from the configuration, not loaded from
          a model, which is why the unit can change size. The controls for
          building your own come next.
        </p>

        <nav aria-label="Example builds" className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {EXAMPLE_NAMES.map((name) => (
              <li key={name}>
                <Link
                  href={`/scene?build=${name}&view=${view}`}
                  aria-current={name === build ? "page" : undefined}
                  className={`inline-block rounded-md border px-3 py-1.5 text-sm ${
                    name === build
                      ? "border-ink bg-ink text-page"
                      : "border-line text-ink hover:border-ink"
                  }`}
                >
                  {EXAMPLE_LABELS[name]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-4">
          <SceneView
            configuration={configuration}
            description={description}
            preset={view}
          />
        </div>

        <nav aria-label="Camera angle" className="mt-4">
          <ul className="flex flex-wrap gap-2">
            {VIEWS.map((candidate) => (
              <li key={candidate}>
                <Link
                  href={`/scene?build=${build}&view=${candidate}`}
                  aria-current={candidate === view ? "page" : undefined}
                  className={`inline-block rounded-md border px-3 py-1.5 text-sm ${
                    candidate === view
                      ? "border-ink bg-ink text-page"
                      : "border-line text-ink hover:border-ink"
                  }`}
                >
                  {VIEW_LABELS[candidate]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="mt-6 max-w-2xl text-sm text-ink-muted">{description}</p>
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
