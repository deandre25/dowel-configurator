/**
 * Materials, with values that mean something.
 *
 * Oak is a dielectric: no metalness, mid roughness, and a clearcoat standing
 * in for the oil finish. Powder-coated steel is paint over metal — also a
 * dielectric at the surface, slightly rougher, and darker or lighter by
 * finish. Pulls are the only actually metallic surface in the product.
 *
 * Built imperatively from the Three.js materials rather than through JSX, so
 * each one is created once per finish and disposed on unmount. R3F will not do
 * that for a material it did not create.
 */
import {
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
} from "three";
import type { Finish } from "@/lib/domain/grid";
import type { PartType } from "@/lib/scene/assembly";
import { DIMENSIONS } from "@/lib/scene/dimensions";

/** The surfaces a part can have. Fewer than part types, deliberately. */
export type Surface = "frame" | "panel" | "metal";

export const PART_SURFACE: Readonly<Record<PartType, Surface>> = {
  upright: "frame",
  board: "frame",
  back: "panel",
  support: "frame",
  drawerFront: "panel",
  drawerPull: "metal",
  doorPanel: "panel",
  doorPull: "metal",
};

type FinishColours = {
  readonly frame: string;
  readonly panel: string;
};

const COLOURS: Readonly<Record<Finish, FinishColours>> = {
  // Measured off oiled European oak, not picked off a colour wheel.
  OAK: { frame: "#c08f55", panel: "#a97642" },
  CHARCOAL: { frame: "#3a3b3d", panel: "#2f3032" },
  WHITE: { frame: "#e9e6e1", panel: "#dedbd5" },
};

export type SurfaceMaterials = Readonly<Record<Surface, Material>>;

/**
 * Approximate ambient occlusion, computed from the fragment's position rather
 * than from the scene.
 *
 * The expensive, correct version of this is a screen-space pass over the depth
 * buffer. It is not needed here, because the geometry is known: every bay is a
 * box open towards the viewer, so the back of a bay is occluded and the front
 * edge is not, and the amount is a function of how far into the unit the
 * fragment is. The same argument applies to the floor, which darkens the
 * bottom of the unit where it meets it.
 *
 * Two smoothsteps and a multiply, in a shader that was going to run anyway.
 * The earlier screenshots were flat because every face of every box was lit
 * identically by a soft environment; this is what the environment cannot know.
 */
function addApproximateOcclusion(material: MeshPhysicalMaterial): void {
  const backZ = -DIMENSIONS.depth / 2;
  const frontZ = DIMENSIONS.depth / 2;
  const floorFade = DIMENSIONS.bayHeight * 0.55;

  material.onBeforeCompile = (shader) => {
    shader.uniforms["uBackZ"] = { value: backZ };
    shader.uniforms["uFrontZ"] = { value: frontZ };
    shader.uniforms["uFloorFade"] = { value: floorFade };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vDowelWorld;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           vDowelWorld = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
         #else
           vDowelWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
         #endif`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vDowelWorld;
         uniform float uBackZ;
         uniform float uFrontZ;
         uniform float uFloorFade;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         // Deeper into the unit is darker; the front edge is not.
         float dowelDepth = smoothstep( uBackZ, uFrontZ, vDowelWorld.z );
         // And the floor takes light away from the bottom of the unit.
         float dowelFloor = smoothstep( 0.0, uFloorFade, vDowelWorld.y );
         float dowelOcclusion = mix( 0.58, 1.0, dowelDepth ) * mix( 0.80, 1.0, dowelFloor );
         diffuseColor.rgb *= dowelOcclusion;`,
      );
  };
  // Materials with different programs must not share a cache key.
  material.customProgramCacheKey = () => "dowel-occlusion-v1";
}

export function createMaterials(finish: Finish): SurfaceMaterials {
  const colours = COLOURS[finish];
  const wood = finish === "OAK";

  const frame = new MeshPhysicalMaterial({
    color: new Color(colours.frame),
    // Oiled oak is satin; powder coat is a touch flatter.
    roughness: wood ? 0.52 : 0.62,
    metalness: 0,
    // The oil leaves a thin film with its own reflection. Powder coat does not.
    clearcoat: wood ? 0.25 : 0,
    clearcoatRoughness: 0.4,
    // Light passes a little way into timber before it scatters back.
    sheen: wood ? 0.12 : 0,
    sheenColor: new Color(wood ? "#e2bb8a" : "#000000"),
  });

  const panel = new MeshPhysicalMaterial({
    color: new Color(colours.panel),
    roughness: wood ? 0.56 : 0.66,
    metalness: 0,
    clearcoat: wood ? 0.2 : 0,
    clearcoatRoughness: 0.45,
  });

  // Brushed stainless: metallic, and rough enough that the reflection is a
  // smear rather than a mirror.
  const metal = new MeshStandardMaterial({
    color: new Color("#b8bcc0"),
    roughness: 0.34,
    metalness: 0.92,
  });

  // The pulls stand proud of everything and are not in a bay, so they are
  // left alone.
  addApproximateOcclusion(frame);
  addApproximateOcclusion(panel);

  return { frame, panel, metal };
}

export function disposeMaterials(materials: SurfaceMaterials): void {
  for (const material of Object.values(materials)) {
    material.dispose();
  }
}
