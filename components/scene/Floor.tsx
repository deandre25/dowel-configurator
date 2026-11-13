"use client";

/**
 * The floor the unit stands on, and the light that puts a shadow on it.
 *
 * `ShadowMaterial` draws nothing except the shadow falling on it, so the plane
 * is invisible over the page's own background and only the shadow shows. That
 * is what keeps the background the page's rather than the canvas's while still
 * letting the unit sit on something.
 *
 * The light is here rather than in the stage because it has one job — casting
 * this shadow. The unit is lit by the environment map; this adds a small
 * amount of directional light on top, aimed so the shadow falls behind and to
 * the side rather than straight down, which is what makes a shadow read as
 * contact rather than as a dark rectangle.
 *
 * The shadow camera is fitted to the unit's own size. A shadow map spread over
 * a default 10 × 10 metre frustum spends almost all of its resolution on empty
 * floor, and the shadow of a 2-metre object comes back blocky.
 */
import { useEffect, useRef } from "react";
import type { DirectionalLight } from "three";

type FloorProps = {
  /** Outside width of the unit, for sizing the shadow camera. */
  readonly unitWidth: number;
  readonly unitHeight: number;
  readonly unitDepth: number;
};

export function Floor({
  unitWidth,
  unitHeight,
  unitDepth,
}: FloorProps): React.ReactElement {
  const light = useRef<DirectionalLight>(null);

  // The shadow camera has to cover the unit and the floor its shadow lands on,
  // and no more than that.
  const reach = Math.max(unitWidth, unitHeight) * 0.85;

  useEffect(() => {
    const current = light.current;
    if (current === null) {
      return;
    }
    current.target.position.set(0, 0, 0);
    current.target.updateMatrixWorld();
    current.shadow.camera.updateProjectionMatrix();
  }, [reach]);

  return (
    <>
      <directionalLight
        ref={light}
        // High, to the left and a little in front: the shadow then falls to
        // the right and back, where it is visible beside the unit rather than
        // hidden behind it. High enough that the shadow is short — a long one
        // reads as late-afternoon sun, not as a room.
        position={[-unitWidth * 0.55, unitHeight * 3.2, unitDepth * 3.0]}
        // Low, because the environment map is doing the lighting. This light
        // is here to cast a shadow, not to light the unit.
        intensity={0.9}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-reach}
        shadow-camera-right={reach}
        shadow-camera-top={reach}
        shadow-camera-bottom={-reach}
        shadow-camera-near={0.1}
        shadow-camera-far={Math.max(unitWidth, unitHeight) * 6}
        // Panels are thin: too much bias and the shadow detaches from the
        // unit, too little and the flat faces stripe themselves.
        shadow-bias={-0.0004}
        shadow-normalBias={0.014}
        // Variance maps blur the map itself, so this is a real softness.
        shadow-radius={7}
        shadow-blurSamples={16}
      />

      <mesh
        // Just below the unit's base, so the two are never coplanar.
        position={[0, -0.0005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[Math.max(unitWidth, unitDepth) * 6, Math.max(unitWidth, unitDepth) * 6]} />
        {/* Invisible except where a shadow falls on it. */}
        <shadowMaterial transparent opacity={0.4} />
      </mesh>
    </>
  );
}
