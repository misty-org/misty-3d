import {
  AnimationClip,
  Euler,
  PropertyBinding,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
  type KeyframeTrack,
  type Object3D,
} from "three";

/*
 * The characters' shared skeleton (Quaternius's Ultimate Animated Character Pack: 23 bones, the
 * same for every character), as three.js names its bones: a name's dots are dropped on loading,
 * so "UpperArm.R" is "UpperArmR". The figure faces +Z with its left side toward +X; in its own
 * space, as directions are given here, +x is its left, +y up and +z ahead.
 */

const named = (name: string) => PropertyBinding.sanitizeNodeName(name);

export const bones = {
  root: named("Bone"),
  hips: named("Hips"),
  abdomen: named("Abdomen"),
  torso: named("Torso"),
  neck: named("Neck"),
  head: named("Head"),
  shoulderL: named("Shoulder.L"),
  upperArmL: named("UpperArm.L"),
  lowerArmL: named("LowerArm.L"),
  fistL: named("Fist.L"),
  shoulderR: named("Shoulder.R"),
  upperArmR: named("UpperArm.R"),
  lowerArmR: named("LowerArm.R"),
  fistR: named("Fist.R"),
  upperLegL: named("UpperLeg.L"),
  footL: named("Foot.L"),
  footR: named("Foot.R"),
  poleL: named("PoleTarget.L"),
  poleR: named("PoleTarget.R"),
} as const;

/**
 * The bones above the hips. A clip is split into its upper and lower body, so the arms can type,
 * wave or point while the legs walk, stand or sit, each half played on its own.
 */
export const upperBones: ReadonlySet<string> = new Set([
  bones.abdomen,
  bones.torso,
  bones.neck,
  bones.head,
  bones.shoulderL,
  bones.upperArmL,
  bones.lowerArmL,
  bones.fistL,
  bones.shoulderR,
  bones.upperArmR,
  bones.lowerArmR,
  bones.fistR,
]);

/** The bones whose clip positions are where they are, not how long they are: the root and the
 * feet and knees the legs reach for. Every character takes them as they come. */
const placedBones: ReadonlySet<string> = new Set([
  bones.root,
  bones.footL,
  bones.footR,
  bones.poleL,
  bones.poleR,
]);

/**
 * The body bone's name in a loaded skeleton. The pack names its mesh "Body" too, and three.js
 * gives one of the two a suffix ("Body_1") to tell them apart, so the bone is found by being one.
 */
export function bodyBone(root: Object3D): string {
  let found = "";
  root.traverse((node) => {
    if (!found && (node as { isBone?: boolean }).isBone && /^Body(?:_\d+)?$/.test(node.name))
      found = node.name;
  });
  return found;
}

/**
 * Gives a character's body bone the name the clips use, and anything else that had that name
 * another, so every track finds its bone whichever of the two three.js suffixed in each file.
 */
export function matchBodyName(model: Object3D, clipsBody: string): void {
  const own = bodyBone(model);
  if (!own || own === clipsBody) return;
  model.traverse((node) => {
    if (node.name === clipsBody && !(node as { isBone?: boolean }).isBone)
      node.name = `${clipsBody}:mesh`;
  });
  model.traverse((node) => {
    if ((node as { isBone?: boolean }).isBone && node.name === own) node.name = clipsBody;
  });
}

const trackBone = (track: KeyframeTrack) => PropertyBinding.parseTrackName(track.name).nodeName;
const trackProperty = (track: KeyframeTrack) =>
  PropertyBinding.parseTrackName(track.name).propertyName;

/** A clip's upper and lower body, each a clip of its own. */
export function splitClip(clip: AnimationClip): { upper: AnimationClip; lower: AnimationClip } {
  const upper = clip.tracks.filter((track) => upperBones.has(trackBone(track)));
  const lower = clip.tracks.filter((track) => !upperBones.has(trackBone(track)));
  return {
    upper: new AnimationClip(`${clip.name}:upper`, clip.duration, upper),
    lower: new AnimationClip(`${clip.name}:lower`, clip.duration, lower),
  };
}

/** Each bone's resting position under its parent: how long each bone is, in a character. */
export function restPositions(root: Object3D): Map<string, Vector3> {
  const rest = new Map<string, Vector3>();
  root.traverse((node) => {
    if ((node as { isBone?: boolean }).isBone) rest.set(node.name, node.position.clone());
  });
  return rest;
}

/**
 * A clip made for one character, fitted to another of the same skeleton but other proportions.
 * Rotations carry over as they are. The root, feet and knee targets keep their positions. The
 * body's height moves by however much higher or lower this character's hips sit. Every other
 * bone keeps its own length, so no track moves it, and no bone is scaled.
 */
export function fitClip(
  clip: AnimationClip,
  from: Map<string, Vector3>,
  to: Map<string, Vector3>,
  /** The body bone's name, as the clips have it (`bodyBone`). */
  body: string,
): AnimationClip {
  const tracks: KeyframeTrack[] = [];
  for (const track of clip.tracks) {
    const bone = trackBone(track);
    const property = trackProperty(track);
    if (property === "scale") continue;
    if (property !== "position" || placedBones.has(bone)) {
      tracks.push(track);
      continue;
    }
    if (bone !== body) continue;
    const before = from.get(bone);
    const after = to.get(bone);
    if (!before || !after) continue;
    const shift = after.clone().sub(before);
    const values = Float32Array.from(track.values);
    for (let index = 0; index < values.length; index += 3) {
      values[index] = values[index]! + shift.x;
      values[index + 1] = values[index + 1]! + shift.y;
      values[index + 2] = values[index + 2]! + shift.z;
    }
    tracks.push(new VectorKeyframeTrack(track.name, Array.from(track.times), Array.from(values)));
  }
  return new AnimationClip(clip.name, clip.duration, tracks);
}

/** A direction in the figure's own space: +x its left, +y up, +z ahead. */
export type Aim = readonly [x: number, y: number, z: number];

/** Where an arm points: its upper arm from the shoulder, and its forearm from the elbow. */
export interface ArmAim {
  upper: Aim;
  lower: Aim;
}

/** Small turns of a spine bone, in radians, about its own axes: x bends it forward. */
export type Bend = readonly [x: number, y: number, z: number];

/**
 * A pose of the upper body: where each arm points (the right arm's, mirrored for the left when
 * only `right` is given and `mirror` is set), and how far the spine and head bend.
 */
export interface PoseSpec {
  right?: ArmAim;
  left?: ArmAim;
  /** The left arm does what the right does, mirrored. */
  mirror?: boolean;
  abdomen?: Bend;
  torso?: Bend;
  neck?: Bend;
  head?: Bend;
}

/** The upper body as it rests: each bone's own turn, and the hips' turn they all hang from. */
export interface RestPose {
  local: Map<string, Quaternion>;
  /** The hips' turn in the figure's space, which every upper bone hangs from. */
  hips: Quaternion;
}

/** The upper body's resting turns, read off a skeleton already in its resting pose. */
export function readRestPose(root: Object3D): RestPose {
  const local = new Map<string, Quaternion>();
  for (const name of upperBones) {
    const node = root.getObjectByName(name);
    if (node) local.set(name, node.quaternion.clone());
  }
  const hips = root.getObjectByName(bones.hips);
  const turn = new Quaternion();
  if (hips) {
    root.updateMatrixWorld(true);
    hips.getWorldQuaternion(turn);
    const base = new Quaternion();
    root.getWorldQuaternion(base);
    turn.premultiply(base.invert());
  }
  return { local, hips: turn };
}

/** The way every bone runs from its joint toward its child: its own +y. */
const along = new Vector3(0, 1, 0);
const scratch = new Vector3();

/** The turn under `parent` that points a bone (which runs along its own +y) along `aim`. */
function aimBone(parent: Quaternion, rest: Quaternion, aim: Aim): Quaternion {
  const world = parent.clone().multiply(rest);
  const now = along.clone().applyQuaternion(world);
  const want = scratch.set(aim[0], aim[1], aim[2]).normalize();
  const swing = new Quaternion().setFromUnitVectors(now, want);
  const aimed = swing.multiply(world);
  return parent.clone().invert().multiply(aimed);
}

const mirrored = (aim: Aim): Aim => [-aim[0], aim[1], aim[2]];
const bent = (rest: Quaternion | undefined, bend: Bend | undefined) =>
  rest && bend ? rest.clone().multiply(new Quaternion().setFromEuler(new Euler(...bend))) : rest;

/**
 * Each upper bone's own turn for a pose: the spine bent as it says, then each arm pointed down
 * the chain from its shoulder, so the hand ends where the directions take it.
 */
export function solvePose(rest: RestPose, spec: PoseSpec): Map<string, Quaternion> {
  const turns = new Map<string, Quaternion>();
  for (const [name, turn] of rest.local) turns.set(name, turn.clone());
  const set = (name: string, turn: Quaternion | undefined) => turn && turns.set(name, turn);
  set(bones.abdomen, bent(rest.local.get(bones.abdomen), spec.abdomen));
  set(bones.torso, bent(rest.local.get(bones.torso), spec.torso));
  set(bones.neck, bent(rest.local.get(bones.neck), spec.neck));
  set(bones.head, bent(rest.local.get(bones.head), spec.head));
  // The torso's turn in the figure's space, which both shoulders hang from.
  const torso = rest.hips
    .clone()
    .multiply(turns.get(bones.abdomen)!)
    .multiply(turns.get(bones.torso)!);
  const arms = [
    { aim: spec.right, side: "R" as const },
    {
      aim: spec.left ?? (spec.mirror && spec.right ? mirror(spec.right) : undefined),
      side: "L" as const,
    },
  ];
  for (const { aim, side } of arms) {
    if (!aim) continue;
    const shoulder = side === "R" ? bones.shoulderR : bones.shoulderL;
    const upper = side === "R" ? bones.upperArmR : bones.upperArmL;
    const lower = side === "R" ? bones.lowerArmR : bones.lowerArmL;
    const atShoulder = torso.clone().multiply(turns.get(shoulder)!);
    const upperTurn = aimBone(atShoulder, rest.local.get(upper)!, aim.upper);
    turns.set(upper, upperTurn);
    const atElbow = atShoulder.multiply(upperTurn);
    turns.set(lower, aimBone(atElbow, rest.local.get(lower)!, aim.lower));
  }
  return turns;
}

/** The left arm's aim for the right arm's, mirrored across the figure. */
export const mirror = (arm: ArmAim): ArmAim => ({
  upper: mirrored(arm.upper),
  lower: mirrored(arm.lower),
});

/**
 * An upper-body clip from poses at moments through it: each bone eased from one pose to the next,
 * the last coming back round to the first when it loops.
 */
export function poseClip(
  name: string,
  rest: RestPose,
  frames: readonly { at: number; pose: PoseSpec }[],
  duration: number,
): AnimationClip {
  const solved = frames.map((frame) => solvePose(rest, frame.pose));
  const tracks = [...rest.local.keys()].map((bone) => {
    const values: number[] = [];
    for (const turns of solved) values.push(...turns.get(bone)!.toArray());
    return new QuaternionKeyframeTrack(
      `${bone}.quaternion`,
      frames.map((frame) => frame.at),
      values,
    );
  });
  return new AnimationClip(`${name}:upper`, duration, tracks);
}
