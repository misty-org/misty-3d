import { useGLTF } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, type MutableRefObject } from "react";
import type { AnimationClip, Color, Material, Mesh, Object3D } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { animationsUrl, characterUrl } from "./characterModels";
import {
  FigureAnimator,
  fitFigureClips,
  readClipSource,
  type ClipSource,
  type FigureClips,
} from "./FigureAnimator";

/**
 * How much the pack's characters are scaled down: theirs are about 3.3 units tall, the building's
 * figures about 1.45, big heads and all.
 */
export const FIGURE_SCALE = 0.44;

/** The skin a figure wears when nobody chose one. */
const DEFAULT_SKIN = "#e8b98f";

/** What a figure is dressed in: its skin, hair, shirt and trousers, over the character's own. */
export interface FigureColors {
  skin?: string;
  hair?: string;
  shirt?: string;
  trousers?: string;
}

/** Which of a character's materials each colour paints, by the names the pack gives them. */
const painted: Record<keyof FigureColors, string> = {
  skin: "Skin",
  hair: "Hair",
  shirt: "Shirt",
  trousers: "Pants",
};

/** A figure's handle on its character once it has loaded: its animator, and how it sits. */
export interface FigureHandle {
  animator: FigureAnimator;
  /** How high its thighs are once sat, scaled into the building: what a seat lifts it to meet. */
  seatedThigh: number;
  /** How far forward it sits, scaled into the building, so its hips land on the seat rather than
   * against the backrest the pack's sit-down reaches back for. */
  seatedForward: number;
}

/** Where a sitter's hips rest behind the middle of a seat, leaving the front for the thighs. */
const SEAT_BACK = 0.12;

type Loaded = { scene: Object3D; animations: AnimationClip[] };
const sources = new WeakMap<object, ClipSource>();
const fitted = new WeakMap<object, FigureClips>();

/** Everyone's shared clips and made moves, read once. */
function sourceOf(loaded: Loaded): ClipSource {
  let source = sources.get(loaded);
  if (!source) {
    source = readClipSource(loaded.scene, loaded.animations);
    sources.set(loaded, source);
  }
  return source;
}

/** One character's fitted clips, worked out once for its file. */
function clipsOf(model: Loaded, source: ClipSource): FigureClips {
  let clips = fitted.get(model);
  if (!clips) {
    clips = fitFigureClips(model.scene, source);
    fitted.set(model, clips);
  }
  return clips;
}

const materialsOf = (mesh: Mesh): Material[] =>
  Array.isArray(mesh.material) ? mesh.material : [mesh.material];

/**
 * One figure's character: the pack's model, its own copy so it moves alone, with its own
 * materials so it can be dressed, casting shadows and never culled mid-stride. It hands its
 * animator to the figure through `handle`, which plays it from the figure's own frame.
 */
export function CharacterModel(props: {
  model: string;
  colors: FigureColors;
  handle: MutableRefObject<FigureHandle | null>;
}) {
  const model = useGLTF(characterUrl(props.model), false, true) as unknown as Loaded;
  const shared = useGLTF(animationsUrl, false, true) as unknown as Loaded;
  const source = sourceOf(shared);
  const clips = clipsOf(model, source);
  const scene = useMemo(() => {
    const copy = cloneSkinned(model.scene);
    copy.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((material) => material.clone())
        : mesh.material.clone();
    });
    return copy;
  }, [model.scene]);
  useEffect(
    () => () =>
      scene.traverse((node) => {
        const mesh = node as Mesh;
        if (mesh.isMesh) for (const material of materialsOf(mesh)) material.dispose();
      }),
    [scene],
  );
  // The pack's own skin is near black: every figure wears a skin tone, its own or a warm one.
  const { skin = DEFAULT_SKIN, hair, shirt, trousers } = props.colors;
  useEffect(() => {
    const wanted = new Map<string, string>();
    for (const [part, name] of Object.entries(painted) as [keyof FigureColors, string][]) {
      const color = { skin, hair, shirt, trousers }[part];
      if (color) wanted.set(name, color);
    }
    scene.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      for (const material of materialsOf(mesh)) {
        const color = wanted.get(material.name);
        const paint = (material as Material & { color?: Color }).color;
        if (color && paint) paint.set(color);
      }
    });
  }, [scene, skin, hair, shirt, trousers]);
  const { handle } = props;
  useLayoutEffect(() => {
    const animator = new FigureAnimator(scene, clips);
    handle.current = {
      animator,
      seatedThigh: clips.seatedThigh * FIGURE_SCALE,
      seatedForward: Math.max(0, clips.seatedBack * FIGURE_SCALE - SEAT_BACK),
    };
    return () => {
      animator.dispose();
      handle.current = null;
    };
  }, [scene, clips, handle]);
  return <primitive object={scene} scale={FIGURE_SCALE} />;
}

/** Starts fetching the shared clips as soon as the building opens. */
export function preloadFigures(models: readonly string[]): void {
  useGLTF.preload(animationsUrl, false, true);
  for (const model of models) useGLTF.preload(characterUrl(model), false, true);
}
