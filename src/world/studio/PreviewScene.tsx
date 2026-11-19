import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import { Quaternion, Vector3, type Group } from "three";
import { DESK_SCREEN, MONITOR } from "./building";
import { DESK_SEAT } from "./catalog";
import { CharacterModel, type FigureHandle } from "./figure/CharacterModel";
import { Workstation } from "./FurnitureGame";
import { Bookshelf, Cooler } from "./FurnitureWork";
import { Plant } from "./FurnitureLounge";
import { Box } from "./parts";
import { lookRotation } from "./walkCamera";

/** One loop of the preview, in seconds, and its moments. */
const LOOP = 9;
const WALKED = 2.2;
const STEPPED = 2.8;
const SAT = 3.6;
const ZOOM_FROM = 4.6;
const ZOOM_TO = 5.8;
/** The page shows from the end of the zoom until here, then the loop starts again. */
export const PAGE_UNTIL = 8.2;

/** The desk stands at the middle of the floor, its chair just in front. */
const START = new Vector3(-2.2, 0, 1.8);
const BESIDE = new Vector3(0, 0, 1.0);
const CHAIR = new Vector3(0, 0, 0.2);
const SEAT_Y = DESK_SEAT;
const WALK_YAW = Math.atan2(BESIDE.x - START.x, BESIDE.z - START.z);
const THIGH = 0.05;

const ease = (t: number) => t * t * (3 - 2 * t);
const part = (time: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (time - from) / (to - from)));

/** Where the camera starts, taking in the desk, and where it ends, in the screen. */
const wide = { position: new Vector3(2.6, 2.3, 3.6), look: new Vector3(0, 0.75, 0.2) };
const screen = (() => {
  // The desk's big screen is a little left of its middle, as `computerView` has it.
  const position = new Vector3(DESK_SCREEN.x, MONITOR.y + 0.02, MONITOR.z + 0.5);
  return {
    position,
    rotation: lookRotation(position, new Vector3(DESK_SCREEN.x, MONITOR.y, MONITOR.z)),
  };
})();
const wideRotation = lookRotation(wide.position, wide.look);

/** The figure walking to the desk, sitting down and typing, then the camera moving in. */
function Story(props: { still: boolean; onPage(shown: boolean): void }) {
  const figure = useRef<Group>(null);
  const handle = useRef<FigureHandle | null>(null);
  const camera = useThree((state) => state.camera);
  const page = useRef(false);
  const turn = useRef(new Quaternion());
  useFrame(({ clock }, delta) => {
    const time = props.still ? SAT + 0.5 : clock.elapsedTime % LOOP;
    const walked = ease(part(time, 0, WALKED));
    const stepped = ease(part(time, WALKED, STEPPED));
    const sit = ease(part(time, STEPPED, SAT));
    const at = START.clone().lerp(BESIDE, walked).lerp(CHAIR, stepped);
    const walking = time < WALKED;
    const thigh = handle.current?.seatedThigh ?? SEAT_Y;
    // Facing the desk (-z) once sat, a little forward so the hips land on the seat.
    const forward = sit * (handle.current?.seatedForward ?? 0);
    figure.current?.position.set(at.x, sit * (SEAT_Y + THIGH - thigh), at.z - forward);
    // Facing the way it walks, then turned to sit facing the desk.
    if (figure.current) figure.current.rotation.y = walking ? WALK_YAW : Math.PI;
    handle.current?.animator.update(props.still ? 0 : Math.min(delta, 0.1), {
      speed: walking ? 4 : time < STEPPED ? 1 : 0,
      sit,
      airborne: false,
      victory: false,
      upper: time > SAT ? "type" : "idle",
      look: { turn: 0, nod: 0, tip: 0 },
      sway: 0,
    });
    // The camera, eased from taking in the desk into the screen.
    const zoom = props.still ? 0 : ease(part(time, ZOOM_FROM, ZOOM_TO));
    camera.position.lerpVectors(wide.position, screen.position, zoom);
    camera.quaternion.copy(turn.current.slerpQuaternions(wideRotation, screen.rotation, zoom));
    const showing = !props.still && time >= ZOOM_TO && time < PAGE_UNTIL;
    if (showing !== page.current) {
      page.current = showing;
      props.onPage(showing);
    }
  });
  return (
    <>
      <group position={[0, 0, 0]}>
        <Workstation />
      </group>
      <group ref={figure} position={START.toArray()}>
        <Suspense fallback={null}>
          <CharacterModel model="casual-female" colors={{ shirt: "#4d9de0" }} handle={handle} />
        </Suspense>
      </group>
    </>
  );
}

/**
 * Game mode in a few seconds, for the choice between Classic and Game: someone walks to their
 * desk in the building, sits down and starts typing, and the camera moves into their screen,
 * where the real page takes over (drawn over this by `GamePreview`).
 */
export default function PreviewScene(props: { still: boolean; onPage(shown: boolean): void }) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={props.still ? "demand" : "always"}
      camera={{ fov: 40, near: 0.05, far: 50, position: wide.position.toArray() }}
      gl={{ antialias: true, alpha: true }}
    >
      <hemisphereLight args={["#fff6e6", "#8f8172", 1]} />
      <directionalLight position={[3, 6, 4]} intensity={2} color="#fff0d8" />
      {/* A corner of the building: the floor, two walls and a few things by them. */}
      <Box size={[7, 0.1, 6]} at={[0, -0.05, 0.5]} color="#e9dcc6" shadow={false} />
      <Box size={[7, 2.6, 0.1]} at={[0, 1.3, -1.6]} color="#f4efe6" shadow={false} />
      <Box size={[0.1, 2.6, 6]} at={[-3.5, 1.3, 0.5]} color="#efe7da" shadow={false} />
      <group position={[-2.2, 0, -1.2]}>
        <Bookshelf id="preview" />
      </group>
      <group position={[1.9, 0, -1.2]}>
        <Cooler />
      </group>
      <group position={[2.6, 0, -1.1]}>
        <Plant id="preview" />
      </group>
      <Story still={props.still} onPage={props.onPage} />
    </Canvas>
  );
}
