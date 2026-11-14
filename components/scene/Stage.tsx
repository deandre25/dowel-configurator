"use client";

/**
 * The scene around the unit: lighting, grounding, camera.
 *
 * What is deliberately absent is as much the point as what is here. There is
 * no ambient light and no directional light; the unit is lit by an environment
 * map, which is what gives a dielectric surface something to reflect. There is
 * no background inside the canvas — the canvas is transparent and the page's
 * own colour shows through, so the unit sits on the page rather than in a box.
 * Nothing rotates on its own.
 */
import { Environment, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import type { Configuration } from "@/lib/domain/grid";
import { unitSize } from "@/lib/scene/dimensions";
import { Floor } from "@/components/scene/Floor";
import { Unit, type RenderStats } from "@/components/scene/Unit";

export type CameraPreset = "threeQuarter" | "front" | "side";

/**
 * Directions, not positions: the distance is computed from the size of the
 * unit so a 2 × 2 and a 6 × 5 are both framed.
 */
const PRESET_DIRECTION: Readonly<Record<CameraPreset, [number, number, number]>> =
  {
    threeQuarter: [0.78, 0.42, 1],
    front: [0, 0.22, 1],
    side: [1, 0.3, 0.42],
  };

type StageProps = {
  readonly configuration: Configuration;
  readonly preset?: CameraPreset;
  readonly instant: boolean;
  readonly onFrame?: (stats: RenderStats, frameMs: number) => void;
  readonly onGpuSamples?: (
    samples: readonly number[],
    available: boolean,
  ) => void;
};

const FIELD_OF_VIEW = 32;

/**
 * Frames the unit from its own size rather than from a distance that happened
 * to look right for one of them.
 *
 * The distance comes from the unit's bounding sphere and the field of view:
 * `radius / sin(fov / 2)` fits a sphere of that radius whatever the viewport's
 * aspect and whatever angle the camera is at. Two earlier attempts — a fixed
 * multiple of the largest dimension, then a vertical-extent calculation —
 * both cropped the base of the unit, which cut off the contact shadow and left
 * it looking as though it were floating. A sphere cannot be cropped by an
 * elevation angle, which is what both of those forgot.
 */
function cameraFor(
  configuration: Configuration,
  preset: CameraPreset,
): { position: [number, number, number]; target: [number, number, number] } {
  const size = unitSize(configuration.width, configuration.height);
  const radius =
    Math.hypot(size.width, size.height, size.depth) / 2 +
    // A band of floor below the unit, so it stands on something.
    size.height * 0.08;
  const vertical = FIELD_OF_VIEW * (Math.PI / 180);
  const reach = radius / Math.sin(vertical / 2);

  const direction = PRESET_DIRECTION[preset];
  const length = Math.hypot(...direction);
  const centre: [number, number, number] = [0, size.height / 2, 0];
  return {
    position: [
      (direction[0] / length) * reach,
      centre[1] + (direction[1] / length) * reach,
      (direction[2] / length) * reach,
    ],
    target: centre,
  };
}

export function Stage({
  configuration,
  preset = "threeQuarter",
  instant,
  onFrame,
  onGpuSamples,
}: StageProps): React.ReactElement {
  const camera = cameraFor(configuration, preset);
  const size = unitSize(configuration.width, configuration.height);

  return (
    <Canvas
      // Transparent: the background belongs to the page.
      gl={{
        antialias: true,
        alpha: true,
        toneMapping: ACESFilmicToneMapping,
        outputColorSpace: SRGBColorSpace,
        // Tone mapping needs headroom to map from, so the exposure is set
        // rather than left at 1 and clipped.
        toneMappingExposure: 0.95,
      }}
      // Capped at 2: beyond that the cost is real and the gain is not.
      dpr={[1, 2]}
      camera={{
        position: camera.position,
        fov: FIELD_OF_VIEW,
        near: 0.1,
        far: 50,
      }}
      // Variance shadow mapping, for the shadow the unit casts on the floor.
      // Percentage-closer filtering gives a hard edge whose width is fixed by
      // the kernel; variance maps take a blur radius, which is what a shadow
      // in a room actually has. Everything else is lit by the environment map.
      shadows="variance"
      // On demand, not continuously. Nothing in this scene moves on its own,
      // so a frame is drawn when the configuration changes, while a change is
      // easing, or while the camera is being dragged — and not otherwise.
      frameloop="demand"
    >
      <Environment
        files="/environment/studio-small-09-256.hdr"
        // Lighting and reflections only; it is never drawn behind the unit.
        background={false}
        environmentIntensity={1}
      />

      <Unit
        configuration={configuration}
        instant={instant}
        {...(onFrame === undefined ? {} : { onFrame })}
        {...(onGpuSamples === undefined ? {} : { onGpuSamples })}
      />

      <Floor
        unitWidth={size.width}
        unitHeight={size.height}
        unitDepth={size.depth}
      />

      <OrbitControls
        makeDefault
        target={camera.target}
        enablePan={false}
        enableZoom
        minDistance={Math.max(size.width, size.height) * 0.9}
        maxDistance={Math.max(size.width, size.height) * 3.2}
        // Never under the floor, and never straight down on it.
        minPolarAngle={Math.PI * 0.12}
        maxPolarAngle={Math.PI * 0.49}
        // Three quarters of a turn either way: enough to see the unit from any
        // useful angle, not enough to end up behind it looking at a back panel.
        minAzimuthAngle={-Math.PI * 0.75}
        maxAzimuthAngle={Math.PI * 0.75}
        enableDamping={!instant}
        dampingFactor={0.08}
        rotateSpeed={0.8}
      />
    </Canvas>
  );
}
