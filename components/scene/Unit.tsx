"use client";

/**
 * The unit, as one instanced mesh per part type.
 *
 * Written against the Three.js API rather than through R3F's JSX elements,
 * because what matters here is exactly what is being allocated and when:
 *
 * - One `BoxGeometry` and one `CylinderGeometry`, shared by every mesh that
 *   needs them. Each part's real size comes from the scale in its instance
 *   matrix, so a 1 × 1 × 1 box describes every panel in the product.
 * - One `InstancedMesh` per part type, allocated once at `PART_CAPACITY` and
 *   never reallocated. Changing the configuration writes matrices and sets
 *   `count`; it does not add, remove or replace an object in the scene graph.
 * - Draw calls therefore do not grow with the size of the unit. A full
 *   6 × 5 unit with 29 modules draws in the same number of calls as a 2 × 2
 *   with one shelf.
 *
 * Everything allocated here is disposed on unmount, including the geometries
 * and the materials, which R3F does not own and will not collect.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from "three";
import type { Configuration } from "@/lib/domain/grid";
import {
  PART_CAPACITY,
  PART_SHAPE,
  PART_TYPES,
  assembleUnit,
  type PartType,
} from "@/lib/scene/assembly";
import { PartTransition } from "@/lib/scene/transition";
import {
  PART_SURFACE,
  createMaterials,
  disposeMaterials,
} from "@/components/scene/materials";

export type RenderStats = {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly instancedMeshes: number;
  readonly geometries: number;
  readonly programs: number;
};

type UnitProps = {
  readonly configuration: Configuration;
  /** Set when the visitor has asked for reduced motion. */
  readonly instant: boolean;
  /** Called after each rendered frame, if anything wants the numbers. */
  readonly onFrame?: (stats: RenderStats, frameMs: number) => void;
};

export function Unit({
  configuration,
  instant,
  onFrame,
}: UnitProps): React.ReactElement {
  const geometries = useMemo<Record<"box" | "rod", BufferGeometry>>(() => {
    // A unit cube and a unit-length rod. Every part is one of these, scaled.
    const box = new BoxGeometry(1, 1, 1);
    // Radius 0.5 so an instance scale of `diameter` gives that diameter.
    const rod = new CylinderGeometry(0.5, 0.5, 1, 14, 1);
    return { box, rod };
  }, []);

  const materials = useMemo(
    () => createMaterials(configuration.finish),
    [configuration.finish],
  );

  const meshes = useMemo(() => {
    const created = new Map<PartType, InstancedMesh>();
    for (const type of PART_TYPES) {
      const mesh = new InstancedMesh(
        geometries[PART_SHAPE[type]],
        materials[PART_SURFACE[type]],
        PART_CAPACITY[type],
      );
      mesh.name = `dowel:${type}`;
      // Panels cast into the floor's shadow map. The pulls do not: a 12 mm rod
      // contributes nothing to a shadow cast from three metres away, and
      // leaving them out is two fewer draws in the shadow pass.
      //
      // Nothing receives: the unit is lit by the environment, and a
      // self-shadowing panel at this scale reads as dirt rather than shade.
      mesh.castShadow = type !== "drawerPull" && type !== "doorPull";
      // Instance matrices change every frame of a transition.
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      // The bounding volume of an instanced mesh is the geometry's, not the
      // instances', so culling it would cull the whole unit at the wrong time.
      mesh.frustumCulled = false;
      mesh.count = 0;
      created.set(type, mesh);
    }
    return created;
  }, [geometries, materials]);

  const transition = useMemo(() => new PartTransition(instant), [instant]);

  // Scratch objects, reused for every instance of every frame rather than
  // allocated inside the loop.
  const scratch = useRef({
    matrix: new Matrix4(),
    position: new Vector3(),
    scale: new Vector3(),
    quaternion: new Quaternion(),
    euler: new Euler(),
  });

  useEffect(() => {
    transition.setTarget(assembleUnit(configuration));
  }, [configuration, transition]);

  useEffect(() => {
    return () => {
      for (const mesh of meshes.values()) {
        mesh.dispose();
      }
    };
  }, [meshes]);

  useEffect(() => {
    return () => {
      disposeMaterials(materials);
    };
  }, [materials]);

  useEffect(() => {
    return () => {
      for (const geometry of Object.values(geometries)) {
        geometry.dispose();
      }
    };
  }, [geometries]);

  useFrame((state, delta) => {
    const started = performance.now();
    transition.advance(delta);

    const { matrix, position, scale, quaternion, euler } = scratch.current;
    const grouped = transition.byType();

    for (const type of PART_TYPES) {
      const mesh = meshes.get(type);
      if (mesh === undefined) {
        continue;
      }
      const parts = grouped.get(type) ?? [];
      // Never write past the buffer. The assembly tests assert this cannot
      // happen for any input; the clamp is here because the consequence of
      // being wrong would be a silent out-of-range write.
      const count = Math.min(parts.length, PART_CAPACITY[type]);

      for (let index = 0; index < count; index += 1) {
        const part = parts[index];
        if (part === undefined) {
          continue;
        }
        position.set(...part.pose.position);
        scale.set(...part.pose.scale);
        euler.set(...part.pose.rotation);
        quaternion.setFromEuler(euler);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(index, matrix);
      }

      if (count > 0 || mesh.count > 0) {
        mesh.instanceMatrix.needsUpdate = true;
      }
      mesh.count = count;
    }

    if (onFrame !== undefined) {
      const info = state.gl.info;
      onFrame(
        {
          drawCalls: info.render.calls,
          triangles: info.render.triangles,
          instancedMeshes: [...meshes.values()].filter((m) => m.count > 0)
            .length,
          geometries: info.memory.geometries,
          programs: info.programs?.length ?? 0,
        },
        performance.now() - started,
      );
    }
  });

  return (
    <group>
      {[...meshes.values()].map((mesh) => (
        <primitive key={mesh.name} object={mesh} />
      ))}
    </group>
  );
}
