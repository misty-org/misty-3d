// @vitest-environment node
import { readFileSync } from "node:fs";
import { AnimationMixer, Vector3, type AnimationClip, type Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { beforeAll, describe, expect, it } from "vitest";
import { madePoses, makePoseClips, type MadePose } from "./poses";
import {
  bodyBone,
  bones,
  fitClip,
  readRestPose,
  restPositions,
  splitClip,
  upperBones,
} from "./rig";

let root: Group;
let clips: Record<string, AnimationClip>;
let made: Map<MadePose, AnimationClip>;
let mixer: AnimationMixer;

beforeAll(async () => {
  // The skeleton and clips every character is animated with, as the app ships them.
  const file = readFileSync("src/shared/assets/characters/animations.glb");
  const data = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const gltf = await new GLTFLoader().parseAsync(data, "");
  root = gltf.scene;
  clips = Object.fromEntries(gltf.animations.map((clip) => [clip.name, clip]));
  mixer = new AnimationMixer(root);
  mixer.clipAction(clips.Idle!).play();
  mixer.update(0);
  root.updateMatrixWorld(true);
  made = makePoseClips(readRestPose(root));
});

/** Where a bone is with the legs standing and the upper body in `pose`, `phase` into it. */
function posed(pose: MadePose, phase = 0) {
  mixer.stopAllAction();
  mixer.clipAction(splitClip(clips.Idle!).lower).reset().play();
  const action = mixer.clipAction(made.get(pose)!);
  action.reset().play();
  action.paused = true;
  action.time = phase * made.get(pose)!.duration;
  mixer.update(0);
  root.updateMatrixWorld(true);
  return (name: string) => root.getObjectByName(name)!.getWorldPosition(new Vector3());
}

describe("the characters' skeleton", () => {
  it("splits a clip into an upper and a lower body that share no bone", () => {
    const { upper, lower } = splitClip(clips.Walk!);
    const boneOf = (name: string) => name.split(".")[0]!;
    const above = new Set(upper.tracks.map((track) => boneOf(track.name)));
    const below = new Set(lower.tracks.map((track) => boneOf(track.name)));
    expect([...above].every((bone) => upperBones.has(bone))).toBe(true);
    expect([...below].some((bone) => upperBones.has(bone))).toBe(false);
    expect(upper.tracks.length + lower.tracks.length).toBe(clips.Walk!.tracks.length);
  });

  it("fits a clip to another character, keeping its bones' lengths and moving its hips", () => {
    const from = restPositions(root);
    const to = new Map([...from].map(([name, at]) => [name, at.clone()]));
    const bodyName = bodyBone(root);
    expect(bodyName).toMatch(/^Body/);
    to.get(bodyName)!.y += 0.1;
    const fitted = fitClip(clips.Idle!, from, to, bodyName);
    const body = fitted.tracks.find((track) => track.name === `${bodyName}.position`)!;
    const original = clips.Idle!.tracks.find((track) => track.name === `${bodyName}.position`)!;
    expect(body.values[1]! - original.values[1]!).toBeCloseTo(0.1, 5);
    // The feet keep where they are; an arm keeps its own length; nothing is scaled.
    expect(fitted.tracks.some((track) => track.name === `${bones.footL}.position`)).toBe(true);
    expect(fitted.tracks.some((track) => track.name === `${bones.upperArmR}.position`)).toBe(false);
    expect(fitted.tracks.some((track) => track.name.endsWith(".scale"))).toBe(false);
  });

  it("makes every move the pack has no clip for, looping round to where it started", () => {
    expect([...made.keys()].sort()).toEqual([...madePoses].sort());
    for (const clip of made.values()) {
      for (const track of clip.tracks) {
        const size = 4;
        const first = track.values.slice(0, size);
        const last = track.values.slice(track.values.length - size);
        for (let index = 0; index < size; index += 1)
          expect(last[index]).toBeCloseTo(first[index]!, 5);
      }
    }
  });
});

describe("the moves the pack has no clip for", () => {
  it("raises a hand for an approval, up beside the head where it shows from behind too", () => {
    const at = posed("hand");
    expect(at(bones.fistR).y).toBeGreaterThan(at(bones.head).y + 0.4);
    // The head is about 1.1 across: the hand is clear of it.
    expect(Math.abs(at(bones.fistR).x - at(bones.head).x)).toBeGreaterThan(0.6);
    expect(at(bones.fistL).y).toBeLessThan(at(bones.shoulderL).y);
  });

  it("waves with the right hand up and out to the side", () => {
    const at = posed("wave");
    expect(at(bones.fistR).y).toBeGreaterThan(at(bones.head).y);
    expect(at(bones.fistR).x).toBeLessThan(at(bones.shoulderR).x);
  });

  it("types with both hands out in front, about level with the shoulders, never above", () => {
    const at = posed("type");
    for (const fist of [bones.fistL, bones.fistR]) {
      expect(at(fist).z).toBeGreaterThan(at(bones.hips).z + 0.6);
      expect(at(fist).y).toBeLessThan(at(bones.shoulderR).y + 0.1);
    }
  });

  it("claps: the hands open wide, then meet in front", () => {
    const open = posed("clap", 0);
    const gap = (at: (name: string) => Vector3) => at(bones.fistR).distanceTo(at(bones.fistL));
    expect(gap(open)).toBeGreaterThan(1);
    const shut = posed("clap", 0.5);
    expect(gap(shut)).toBeLessThan(0.35);
    expect(shut(bones.fistR).z).toBeGreaterThan(0.5);
  });

  it("thinks with a hand up at the chin, and scratches the side of the head when puzzled", () => {
    const thinking = posed("think");
    const chin = thinking(bones.head).add(new Vector3(0, 0, 0.45));
    expect(thinking(bones.fistR).distanceTo(chin)).toBeLessThan(0.45);
    const puzzled = posed("puzzled");
    expect(puzzled(bones.fistR).y).toBeGreaterThan(puzzled(bones.head).y);
    expect(Math.abs(puzzled(bones.fistR).x)).toBeLessThan(0.6);
  });

  it("points straight ahead, and cheers with both hands up", () => {
    const pointing = posed("point");
    expect(pointing(bones.fistR).z).toBeGreaterThan(pointing(bones.shoulderR).z + 0.8);
    const cheering = posed("cheer");
    for (const fist of [bones.fistL, bones.fistR])
      expect(cheering(fist).y).toBeGreaterThan(cheering(bones.head).y + 0.3);
  });
});
