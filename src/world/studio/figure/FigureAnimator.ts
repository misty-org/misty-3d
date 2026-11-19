import {
  AnimationMixer,
  Euler,
  Quaternion,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from "three";
import { makePoseClips, type MadePose } from "./poses";
import {
  bodyBone,
  bones,
  fitClip,
  matchBodyName,
  readRestPose,
  restPositions,
  splitClip,
} from "./rig";

/** The pack's own clips the figures use; the rest (fighting, falling over) they never do. */
const packClips = ["Idle", "Walk", "Run", "SitDown", "Jump", "Victory", "PickUp"] as const;
type PackClip = (typeof packClips)[number];

/**
 * What everyone's characters share, read once from animations.glb: the clips, the skeleton they
 * were made on (its bones' lengths and resting turns), and the moves made for it here.
 */
export interface ClipSource {
  clips: Map<string, AnimationClip>;
  rest: Map<string, Vector3>;
  /** The body bone's name in the clips. */
  body: string;
  made: Map<MadePose, AnimationClip>;
}

export function readClipSource(root: Object3D, clips: readonly AnimationClip[]): ClipSource {
  const byName = new Map(clips.map((clip) => [clip.name, clip]));
  const mixer = new AnimationMixer(root);
  const idle = byName.get("Idle");
  if (idle) mixer.clipAction(idle).play();
  mixer.update(0);
  root.updateMatrixWorld(true);
  const made = makePoseClips(readRestPose(root));
  mixer.stopAllAction();
  return { clips: byName, rest: restPositions(root), body: bodyBone(root), made };
}

/** One character's clips, fitted to its proportions and split into upper and lower body. */
export interface FigureClips {
  lower: Map<string, AnimationClip>;
  upper: Map<string, AnimationClip>;
  /** How high its thighs are once sat down, in its own units: what a chair's height is met by. */
  seatedThigh: number;
  /** How far back its hips move as it sits, in its own units: the clip sits onto a seat behind. */
  seatedBack: number;
}

/**
 * Fits the shared clips to one character (whose file's scene is passed, never one on show) and
 * measures how it sits.
 */
export function fitFigureClips(model: Object3D, source: ClipSource): FigureClips {
  matchBodyName(model, source.body);
  const to = restPositions(model);
  const lower = new Map<string, AnimationClip>();
  const upper = new Map<string, AnimationClip>();
  for (const name of packClips) {
    const clip = source.clips.get(name);
    if (!clip) continue;
    const halves = splitClip(fitClip(clip, source.rest, to, source.body));
    lower.set(name, halves.lower);
    upper.set(name, halves.upper);
  }
  for (const [name, clip] of source.made) upper.set(name, clip);
  // Sat all the way down, how high the thighs are over the feet, and how far back the hips went.
  const mixer = new AnimationMixer(model);
  const at = (clip: AnimationClip | undefined, time: number, bone: string) => {
    mixer.stopAllAction();
    if (!clip) return null;
    const action = mixer.clipAction(clip);
    action.reset().play();
    action.paused = true;
    action.time = time;
    mixer.update(0);
    model.updateMatrixWorld(true);
    return model.getObjectByName(bone)?.getWorldPosition(new Vector3()) ?? null;
  };
  const sit = lower.get("SitDown");
  const standingHips = at(lower.get("Idle"), 0, bones.hips);
  const seatedHips = sit ? at(sit, sit.duration, bones.hips) : null;
  const seatedThigh = sit ? (at(sit, sit.duration, bones.upperLegL)?.y ?? 0) : 0;
  const seatedBack = standingHips && seatedHips ? Math.max(0, standingHips.z - seatedHips.z) : 0;
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
  return { lower, upper, seatedThigh, seatedBack };
}

/** What a figure's arms and head do: a made move, the pack's pick-up, or what its legs do. */
export type UpperMove = MadePose | "idle" | "pickup";

/** How a figure moves this frame, as its walk and its work decide. */
export interface FigureState {
  /** Ground speed, in the character's own units a second. */
  speed: number;
  /** How far into its seat it is: 0 standing, 1 sat. */
  sit: number;
  airborne: boolean;
  /** The whole body cheering, jumping for joy: only standing. */
  victory: boolean;
  upper: UpperMove;
  /** Its head turned (left positive), nodded (down positive) and tipped, in radians. */
  look: { turn: number; nod: number; tip: number };
  /** Hips swaying side to side, in radians, as in a dance. */
  sway: number;
}

/** The pack's walk and run, in the character's own units a second at their natural pace. */
const NATURAL = { Walk: 1.7, Run: 3.6 };
/** Faster than this it walks; faster again, it runs. */
const WALK_FROM = 0.15;
const RUN_FROM = 4.2;
/** Seconds one move takes to blend into the next. */
const FADE = 0.22;
/** Where in the jump clip the figure is in the air. */
const AIRBORNE_AT = 0.4;

/** One half of the body playing one clip at a time, blending into the next. */
class Layer {
  current: { name: string; action: AnimationAction } | null = null;
  constructor(
    private readonly mixer: AnimationMixer,
    private readonly clips: Map<string, AnimationClip>,
  ) {}
  play(name: string): AnimationAction | null {
    if (this.current?.name === name) return this.current.action;
    const clip = this.clips.get(name);
    if (!clip) return this.current?.action ?? null;
    const action = this.mixer.clipAction(clip);
    action.reset();
    action.enabled = true;
    action.paused = false;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.play();
    if (this.current) action.crossFadeFrom(this.current.action, FADE, false);
    this.current = { name, action };
    return action;
  }
}

const angles = new Euler(0, 0, 0, "YXZ");

/**
 * A turn added on top of what a bone's clip gives it: the head looking about, the hips swaying.
 * The mixer only writes a bone when its clip's value changes, so a held pose is not written again
 * each frame; the turn added last frame is taken off before the mixer runs and the new one put on
 * after, so it never piles up, whether the mixer wrote the bone or not.
 */
class AddedTurn {
  private readonly last = new Quaternion();
  private readonly next = new Quaternion();
  constructor(private readonly bone: Object3D | undefined) {}
  /** Takes last frame's turn off, before the mixer runs. */
  undo() {
    if (this.bone) this.bone.quaternion.multiply(this.last.invert());
    this.last.identity();
  }
  /** Puts this frame's turn on, after the mixer has run. */
  apply(x: number, y: number, z: number) {
    if (!this.bone || (!x && !y && !z)) return;
    angles.set(x, y, z);
    this.next.setFromEuler(angles);
    this.bone.quaternion.multiply(this.next);
    this.last.copy(this.next);
  }
}

/**
 * Plays one figure: its legs walk, run, stand, jump or sit (a seat's progress scrubs the pack's
 * sit-down, so getting up plays it backwards), and its arms and head follow the legs or do a move
 * of their own over them. Its head turns to whoever it looks at, and a dance sways its hips.
 */
export class FigureAnimator {
  private readonly mixer: AnimationMixer;
  private readonly lower: Layer;
  private readonly upper: Layer;
  private readonly head: AddedTurn;
  private readonly hips: AddedTurn;

  constructor(
    private readonly model: Object3D,
    clips: FigureClips,
  ) {
    this.mixer = new AnimationMixer(model);
    this.lower = new Layer(this.mixer, clips.lower);
    this.upper = new Layer(this.mixer, clips.upper);
    this.head = new AddedTurn(model.getObjectByName(bones.head));
    this.hips = new AddedTurn(model.getObjectByName(bones.hips));
    this.update(0, {
      speed: 0,
      sit: 0,
      airborne: false,
      victory: false,
      upper: "idle",
      look: { turn: 0, nod: 0, tip: 0 },
      sway: 0,
    });
  }

  update(seconds: number, state: FigureState): void {
    const legs: PackClip =
      state.sit > 0.001
        ? "SitDown"
        : state.airborne
          ? "Jump"
          : state.speed > RUN_FROM
            ? "Run"
            : state.speed > WALK_FROM
              ? "Walk"
              : state.victory
                ? "Victory"
                : "Idle";
    const lower = this.lower.play(legs);
    if (lower && (legs === "Walk" || legs === "Run")) {
      lower.timeScale = Math.min(3, Math.max(0.5, state.speed / NATURAL[legs]));
    }
    if (lower && (legs === "SitDown" || legs === "Jump")) {
      // Held where the seat, or the jump, has got to.
      lower.paused = true;
      const length = lower.getClip().duration;
      lower.time = legs === "SitDown" ? Math.min(state.sit, 0.999) * length : AIRBORNE_AT * length;
    }
    const arms = state.upper === "idle" ? legs : state.upper === "pickup" ? "PickUp" : state.upper;
    const upper = this.upper.play(arms);
    if (upper && lower && arms === legs) {
      // Following the legs, the arms keep their step.
      upper.paused = lower.paused;
      upper.timeScale = lower.timeScale;
      upper.time = lower.time;
    }
    this.head.undo();
    this.hips.undo();
    this.mixer.update(seconds);
    // The skeleton faces +z with its head's axes as the figure's: +x nods down, +y turns left.
    this.head.apply(state.look.nod, state.look.turn, state.look.tip);
    this.hips.apply(0, 0, state.sway);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
  }
}
