import type { AnimationClip } from "three";
import { mirror, poseClip, type Aim, type ArmAim, type PoseSpec, type RestPose } from "./rig";

/*
 * What the character pack has no clip for, made here as upper-body clips on its shared skeleton:
 * typing at a desk, talking with a hand, waving, a hand raised for an approval, scratching the head
 * over a failed run, thinking, pointing, clapping, dancing, cheering in a seat and playing the
 * arcade. Each is a loop: arm directions (in the figure's own space, +x its left, +y up, +z ahead)
 * and small bends of the spine and head, sampled through one cycle so it comes round smoothly.
 */

/** The upper-body moves made here, by name. */
export type MadePose =
  | "type"
  | "talk"
  | "wave"
  | "hand"
  | "puzzled"
  | "think"
  | "point"
  | "clap"
  | "dance"
  | "cheer"
  | "play";

const TAU = Math.PI * 2;
const mix = (a: Aim, b: Aim, t: number): Aim => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
/** 0 to 1 and back once through the cycle, slow at both ends. */
const swing = (phase: number) => (1 - Math.cos(phase * TAU)) / 2;

/** An arm hanging at the side, as the figure stands at rest. */
const atSide: ArmAim = { upper: [-0.28, -0.96, -0.04], lower: [-0.05, -1, 0.08] };
const leftAtSide = mirror(atSide);

interface Move {
  /** Seconds for one cycle. */
  seconds: number;
  /** Poses through the cycle; the last is the first again. */
  frames: number;
  pose(phase: number): PoseSpec;
}

const moves: Record<MadePose, Move> = {
  // Both hands on the keyboard in front, fingers going one hand then the other, eyes on the screen.
  type: {
    seconds: 0.6,
    frames: 6,
    pose: (p) => ({
      right: { upper: [-0.16, -0.32, 0.93], lower: [0.1, 0.05 + 0.08 * Math.sin(p * TAU), 1] },
      left: { upper: [0.16, -0.32, 0.93], lower: [-0.1, 0.05 - 0.08 * Math.sin(p * TAU), 1] },
      torso: [0.08, 0, 0],
      head: [0.22, 0, 0],
    }),
  },
  // One hand making its points while the other rests, the head nodding along.
  talk: {
    seconds: 2,
    frames: 8,
    pose: (p) => ({
      right: {
        upper: [-0.32, -0.72, 0.6],
        lower: [-0.1 + 0.18 * Math.sin(p * TAU), 0.3 + 0.25 * Math.sin(p * TAU * 2), 0.95],
      },
      left: { upper: [0.25, -0.92, 0.2], lower: [0.1, -0.85, 0.5] },
      head: [0.05 * Math.sin(p * TAU * 2), 0, 0.05 * Math.sin(p * TAU)],
    }),
  },
  // The right hand up and waving side to side.
  wave: {
    seconds: 0.8,
    frames: 8,
    pose: (p) => ({
      right: { upper: [-0.55, 0.78, 0.22], lower: [-0.12 + 0.45 * Math.sin(p * TAU), 0.92, 0.18] },
      left: leftAtSide,
      head: [0, 0, 0.06 * Math.sin(p * TAU)],
    }),
  },
  // A hand up, as a class asks: the agent needs its person. The pack's arms are short and its
  // heads big, so the hand goes up beside the head, where it shows from every side.
  hand: {
    seconds: 1.6,
    frames: 6,
    pose: (p) => ({
      right: {
        upper: [-0.5, 0.86, 0.1],
        lower: [-0.3 + 0.08 * Math.sin(p * TAU), 0.95, 0.05],
      },
      left: leftAtSide,
      head: [-0.08, 0, 0],
    }),
  },
  // Scratching the side of the head, the other hand on the hip: a run of its failed.
  puzzled: {
    seconds: 1.2,
    frames: 8,
    pose: (p) => ({
      right: {
        upper: [-0.72, 0.32, 0.6],
        lower: [0.62 + 0.1 * Math.sin(p * TAU * 2), 0.62, -0.45],
      },
      left: { upper: [0.6, -0.72, -0.12], lower: [-0.45, -0.25, 0.55] },
      head: [-0.05, 0, 0.22],
    }),
  },
  // A hand at the chin, the other arm across the body, looking up a little.
  think: {
    seconds: 2.4,
    frames: 6,
    pose: (p) => ({
      right: { upper: [-0.22, -0.35, 0.91], lower: [0.3, 0.95, -0.05] },
      left: { upper: [0.15, -0.8, 0.55], lower: [-0.75, 0.1, 0.65] },
      head: [-0.12, 0.05 * Math.sin(p * TAU), 0.12],
    }),
  },
  // The right arm straight out ahead.
  point: {
    seconds: 1.6,
    frames: 4,
    pose: (p) => ({
      right: { upper: [-0.18, 0.12 + 0.03 * Math.sin(p * TAU), 0.98], lower: [-0.06, 0.12, 1] },
      left: leftAtSide,
      head: [-0.04, 0, 0],
    }),
  },
  // Hands meeting in front and parting again.
  clap: {
    seconds: 0.5,
    frames: 6,
    pose: (p) => ({
      right: {
        upper: [-0.32, -0.42, 0.85],
        lower: mix([-0.55, 0.15, 0.8], [0.8, 0.15, 0.55], swing(p)),
      },
      mirror: true,
      head: [-0.06, 0, 0],
    }),
  },
  // Arms pumping up one then the other, swaying with them.
  dance: {
    seconds: 0.8,
    frames: 8,
    pose: (p) => {
      const up = (side: number) => (Math.sin(p * TAU + side * Math.PI) + 1) / 2;
      const arm = (sign: number, t: number): ArmAim => ({
        upper: mix([sign * 0.65, 0.1, 0.75], [sign * 0.55, 0.8, 0.25], t),
        lower: mix([sign * 0.1, 0.9, 0.4], [sign * 0.2, 0.95, 0.1], t),
      });
      return {
        right: arm(-1, up(0)),
        left: arm(1, up(1)),
        torso: [0, 0.12 * Math.sin(p * TAU), 0.1 * Math.sin(p * TAU)],
        head: [-0.1, 0, -0.08 * Math.sin(p * TAU)],
      };
    },
  },
  // Both arms up in a V, pumping: a cheer that works sitting down too.
  cheer: {
    seconds: 0.6,
    frames: 6,
    pose: (p) => ({
      right: { upper: [-0.5, 0.85, 0.12], lower: [-0.28, 0.95, 0.05 + 0.15 * Math.sin(p * TAU)] },
      mirror: true,
      head: [-0.18, 0, 0],
    }),
  },
  // Hands on the cabinet's stick and buttons, busy.
  play: {
    seconds: 0.5,
    frames: 6,
    pose: (p) => ({
      right: { upper: [-0.2, -0.72, 0.66], lower: [0.12, -0.2 + 0.06 * Math.sin(p * TAU * 2), 1] },
      left: { upper: [0.2, -0.72, 0.66], lower: [-0.12, -0.2 + 0.06 * Math.cos(p * TAU), 1] },
      head: [0.15, 0, 0],
    }),
  },
};

export const madePoses = Object.keys(moves) as MadePose[];

/** Every made move as an upper-body clip on this skeleton, by name. */
export function makePoseClips(rest: RestPose): Map<MadePose, AnimationClip> {
  const clips = new Map<MadePose, AnimationClip>();
  for (const name of madePoses) {
    const move = moves[name];
    const frames = Array.from({ length: move.frames + 1 }, (_, index) => {
      const phase = index / move.frames;
      return { at: phase * move.seconds, pose: move.pose(phase % 1) };
    });
    clips.set(name, poseClip(name, rest, frames, move.seconds));
  }
  return clips;
}
