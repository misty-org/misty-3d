// @vitest-environment node
import { readFileSync } from "node:fs";
import { Vector3, type AnimationClip, type Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { beforeAll, describe, expect, it } from "vitest";
import {
  FigureAnimator,
  fitFigureClips,
  readClipSource,
  type ClipSource,
  type FigureState,
} from "./FigureAnimator";
import { bodyBone, bones } from "./rig";

const load = async (name: string) => {
  const file = readFileSync(`src/shared/assets/characters/${name}.glb`);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return loader.parseAsync(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    "",
  );
};

let source: ClipSource;
let model: { scene: Group; animations: AnimationClip[] };

beforeAll(async () => {
  const shared = await load("animations");
  source = readClipSource(shared.scene, shared.animations);
  // A character of other proportions than the clips were made on: longer legs.
  model = await load("blue-soldier-female");
});

const standing: FigureState = {
  speed: 0,
  sit: 0,
  airborne: false,
  victory: false,
  upper: "idle",
  look: { turn: 0, nod: 0, tip: 0 },
  sway: 0,
};

describe("a character in the building", () => {
  it("fits the shared clips to its own proportions, and knows how it sits", () => {
    const clips = fitFigureClips(model.scene, source);
    expect([...clips.lower.keys()]).toEqual(
      expect.arrayContaining(["Idle", "Walk", "Run", "SitDown", "Victory"]),
    );
    expect(clips.upper.has("type")).toBe(true);
    expect(clips.upper.has("hand")).toBe(true);
    // Its thighs end up level with a low seat, well under its standing hips.
    expect(clips.seatedThigh).toBeGreaterThan(0.3);
    expect(clips.seatedThigh).toBeLessThan(0.9);
    // The pack's sit-down reaches back for its seat: the figure is moved forward by that much.
    expect(clips.seatedBack).toBeGreaterThan(0.2);
    expect(clips.seatedBack).toBeLessThan(0.8);
    expect(bodyBone(model.scene)).toBe(source.body);
  });

  it("sits down as its seat's progress says, and walks with its feet moving", () => {
    const clips = fitFigureClips(model.scene, source);
    const figure = cloneSkinned(model.scene);
    const animator = new FigureAnimator(figure, clips);
    const where = (name: string) => {
      figure.updateMatrixWorld(true);
      return figure.getObjectByName(name)!.getWorldPosition(new Vector3());
    };
    animator.update(1, standing);
    const hipsStanding = where(bones.hips).y;
    animator.update(1, { ...standing, sit: 1 });
    expect(where(bones.hips).y).toBeLessThan(hipsStanding - 0.2);
    animator.update(1, standing);
    animator.update(0.1, { ...standing, speed: 1.7 });
    const before = where(bones.footL).clone();
    animator.update(0.3, { ...standing, speed: 1.7 });
    expect(where(bones.footL).distanceTo(before)).toBeGreaterThan(0.05);
    animator.dispose();
  });

  it("raises a hand over its head for its person, on top of whatever its legs do", () => {
    const clips = fitFigureClips(model.scene, source);
    const figure = cloneSkinned(model.scene);
    const animator = new FigureAnimator(figure, clips);
    animator.update(1, { ...standing, sit: 1, upper: "hand" });
    figure.updateMatrixWorld(true);
    const fist = figure.getObjectByName(bones.fistR)!.getWorldPosition(new Vector3());
    const head = figure.getObjectByName(bones.head)!.getWorldPosition(new Vector3());
    expect(fist.y).toBeGreaterThan(head.y);
    animator.dispose();
  });

  it("stays upright while its head looks about and its hips sway, however long it holds a pose", () => {
    const clips = fitFigureClips(model.scene, source);
    const figure = cloneSkinned(model.scene);
    const animator = new FigureAnimator(figure, clips);
    const head = () => {
      figure.updateMatrixWorld(true);
      return figure.getObjectByName(bones.head)!.getWorldPosition(new Vector3());
    };
    const swaying = {
      ...standing,
      upper: "dance" as const,
      sway: 0.1,
      look: { turn: 0.3, nod: 0.1, tip: 0 },
    };
    for (let frame = 0; frame < 120; frame += 1) animator.update(1 / 60, swaying);
    const leaning = head();
    // A held sway leans the head a little to one side, never over.
    expect(Math.abs(leaning.x)).toBeLessThan(0.35);
    for (let frame = 0; frame < 60; frame += 1) animator.update(1 / 60, standing);
    expect(Math.abs(head().x)).toBeLessThan(0.1);
    animator.dispose();
  });
});
