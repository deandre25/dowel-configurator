/**
 * Moves the assembly from one configuration to the next without rebuilding it.
 *
 * Parts are tracked by the stable keys `assembleUnit` produces. When the
 * configuration changes:
 *
 * - a key present in both is the same part, and its transform eases to the new
 *   one;
 * - a key that appears is a part that grows in, from nothing to its full size;
 * - a key that goes is a part that shrinks out, and is dropped once it has.
 *
 * Nothing here knows about Three.js. It holds numbers, and the renderer copies
 * them into instance matrices — which is the whole point: changing the
 * configuration writes matrices, it does not touch the scene graph.
 *
 * Easing is exponential, `1 - e^(-rate · dt)`, so the result does not depend on
 * the frame rate: the same change looks the same at 30 fps and at 144.
 */
import type { Part, PartType } from "@/lib/scene/assembly";

export type Vector3 = readonly [number, number, number];

export type Pose = {
  readonly position: Vector3;
  readonly scale: Vector3;
  readonly rotation: Vector3;
};

export type TrackedPart = {
  readonly key: string;
  readonly type: PartType;
  /** Where it is now. */
  pose: Pose;
  /** Where it is going. */
  target: Pose;
  /** True once the part has left the configuration and is shrinking out. */
  leaving: boolean;
};

/** How fast a transform catches up. Higher is snappier. */
const EASE_RATE = 14;

/**
 * A leaving part is dropped once it is thinner than this, in metres. The
 * thinnest real part is the 6 mm back panel, so half a millimetre is well
 * below anything the renderer would show.
 */
const GONE_BELOW_METRES = 0.0005;

function flat(pose: Pose): Pose {
  // A part grows from a flattened version of itself rather than from a point,
  // so it reads as a panel sliding into place rather than a dot inflating.
  return { ...pose, scale: [pose.scale[0], 0, pose.scale[2]] };
}

function poseOf(part: Part): Pose {
  return {
    position: part.position,
    scale: part.scale,
    rotation: part.rotation,
  };
}

function ease(from: number, to: number, factor: number): number {
  return from + (to - from) * factor;
}

function easePose(pose: Pose, target: Pose, factor: number): Pose {
  return {
    position: [
      ease(pose.position[0], target.position[0], factor),
      ease(pose.position[1], target.position[1], factor),
      ease(pose.position[2], target.position[2], factor),
    ],
    scale: [
      ease(pose.scale[0], target.scale[0], factor),
      ease(pose.scale[1], target.scale[1], factor),
      ease(pose.scale[2], target.scale[2], factor),
    ],
    // Rotation is per part type and never changes for a given key, so it is
    // copied rather than interpolated — no part of this product rotates.
    rotation: target.rotation,
  };
}

export class PartTransition {
  private tracked = new Map<string, TrackedPart>();

  /** True while anything is still moving. */
  private moving = false;

  constructor(private readonly instant: boolean = false) {}

  get isMoving(): boolean {
    return this.moving;
  }

  /**
   * Points every part at the new assembly. Parts that are new start flat;
   * parts no longer in the assembly start leaving.
   */
  setTarget(parts: readonly Part[]): void {
    const incoming = new Map(parts.map((part) => [part.key, part]));

    for (const [key, part] of incoming) {
      const existing = this.tracked.get(key);
      const target = poseOf(part);
      if (existing === undefined) {
        this.tracked.set(key, {
          key,
          type: part.type,
          pose: this.instant ? target : flat(target),
          target,
          leaving: false,
        });
        continue;
      }
      existing.target = target;
      existing.leaving = false;
      if (this.instant) {
        existing.pose = target;
      }
    }

    for (const [key, part] of this.tracked) {
      if (incoming.has(key)) {
        continue;
      }
      if (this.instant) {
        this.tracked.delete(key);
        continue;
      }
      part.leaving = true;
      part.target = flat(part.target);
    }

    this.moving = !this.instant;
  }

  /** Advances every part by `deltaSeconds`. Returns true if anything moved. */
  advance(deltaSeconds: number): boolean {
    if (this.instant) {
      this.moving = false;
      return false;
    }

    const factor = 1 - Math.exp(-EASE_RATE * Math.max(deltaSeconds, 0));
    let stillMoving = false;

    for (const [key, part] of this.tracked) {
      part.pose = easePose(part.pose, part.target, factor);

      if (part.leaving && part.pose.scale[1] < GONE_BELOW_METRES) {
        this.tracked.delete(key);
        stillMoving = true;
        continue;
      }

      const settled =
        Math.abs(part.pose.position[0] - part.target.position[0]) < 1e-4 &&
        Math.abs(part.pose.position[1] - part.target.position[1]) < 1e-4 &&
        Math.abs(part.pose.position[2] - part.target.position[2]) < 1e-4 &&
        Math.abs(part.pose.scale[0] - part.target.scale[0]) < 1e-4 &&
        Math.abs(part.pose.scale[1] - part.target.scale[1]) < 1e-4 &&
        Math.abs(part.pose.scale[2] - part.target.scale[2]) < 1e-4;

      if (!settled) {
        stillMoving = true;
      } else {
        part.pose = part.target;
      }
    }

    this.moving = stillMoving;
    return stillMoving;
  }

  /** Every tracked part, grouped by type, for the renderer to write out. */
  byType(): ReadonlyMap<PartType, readonly TrackedPart[]> {
    const grouped = new Map<PartType, TrackedPart[]>();
    for (const part of this.tracked.values()) {
      const existing = grouped.get(part.type);
      if (existing === undefined) {
        grouped.set(part.type, [part]);
      } else {
        existing.push(part);
      }
    }
    // A stable order within each type, so an instance index belongs to the
    // same part from frame to frame.
    for (const parts of grouped.values()) {
      parts.sort((a, b) => a.key.localeCompare(b.key));
    }
    return grouped;
  }

  get size(): number {
    return this.tracked.size;
  }
}
