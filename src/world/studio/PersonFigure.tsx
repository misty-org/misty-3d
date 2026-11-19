import { useFrame } from "@react-three/fiber";
import { Suspense, useRef, type MutableRefObject } from "react";
import type { Group } from "three";
import { EMOTE_MS, type StudioEmote } from "../studioOrders";
import { characterFor } from "./figure/characterModels";
import {
  CharacterModel,
  FIGURE_SCALE,
  type FigureColors,
  type FigureHandle,
} from "./figure/CharacterModel";
import { figurePose } from "./figure/figurePose";
import { characterLook } from "./look";
import { FLOOR_MARK } from "./parts";
import { SPEED } from "./walkPhysics";

/** How the person's own figure is moving this frame, as the walk works it out. */
export interface PersonMotion {
  /** Walking speed, from 0 standing to 1 at full speed. */
  speed: number;
  airborne: boolean;
  /** Upward speed while in the air; negative on the way down. */
  rising: number;
  /** What it acts out while it stands still. */
  emote: { kind: StudioEmote; at: number } | null;
}

/**
 * The person's own figure: the character they walk the building as. It walks and runs at the
 * pace it goes, jumps, and acts out an emote while it stands. A ring on the floor marks it out.
 */
export function PersonFigure(props: {
  motion: MutableRefObject<PersonMotion>;
  still: boolean;
  /** Who the person is, which settles their character until they pick one. */
  who: string;
  look?: { model?: string } & FigureColors;
}) {
  const handle = useRef<FigureHandle | null>(null);
  const body = useRef<Group>(null);
  // Until the person dresses their figure, it wears the look their id settles, as agents do.
  const own = characterLook(props.who);
  const look = { skin: own.skin, hair: own.hair, trousers: own.trousers, ...props.look };
  useFrame(({ clock }, delta) => {
    const { speed, airborne, emote } = props.motion.current;
    const age = emote ? (Date.now() - emote.at) / 1000 : Infinity;
    const pose = figurePose({
      doing: speed > 0.05 ? "walk" : "relax",
      emote: emote && age < EMOTE_MS / 1000 ? { kind: emote.kind, age } : null,
      cheer: null,
      seated: false,
      slumped: false,
      time: clock.elapsedTime,
    });
    if (body.current) body.current.position.y = pose.bounce;
    handle.current?.animator.update(props.still ? 0 : Math.min(delta, 0.1), {
      speed: (speed * SPEED) / FIGURE_SCALE,
      sit: 0,
      airborne,
      victory: pose.victory,
      upper: pose.upper,
      // The person turns their whole figure to look; its head stays still.
      look: { turn: 0, nod: 0, tip: 0 },
      sway: pose.sway,
    });
  });
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_MARK, 0]}>
        <ringGeometry args={[0.34, 0.42, 40]} />
        <meshBasicMaterial color="#f1f1f1" transparent opacity={0.85} />
      </mesh>
      <group ref={body}>
        <Suspense fallback={null}>
          <CharacterModel
            model={characterFor(props.who, look.model)}
            colors={look}
            handle={handle}
          />
        </Suspense>
      </group>
    </>
  );
}
