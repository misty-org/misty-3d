import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { PerspectiveCamera, Quaternion, Vector3, type Group } from "three";
import { ME, clearOf, type Crowd } from "./crowd";
import type { StudioEmote } from "../studioOrders";
import { deskGlass, deskScreenRect } from "../../shell/deskScreen";
import type { ComputerView } from "./building";
import { typingIn } from "./keys";
import { holdPointer, holdingPointer, releasePointer } from "./pointerLock";
import { walkView } from "./view";
import { cellCenter, type Point } from "./grid";
import type { Solid } from "./layout";
import { nearestWalkable, type NavGrid } from "./pathfinding";
import { useStudioCamera } from "./cameraSettings";
import type { FigureColors } from "./figure/CharacterModel";
import { PersonFigure, type PersonMotion } from "./PersonFigure";
import {
  bodyClear,
  moveKeys,
  nearestAhead,
  standingWalker,
  stepWalker,
  withChairs,
  SPEED,
  type Move,
  type Walker,
} from "./walkPhysics";
import {
  DISTANCE,
  FIRST_FOV,
  LOOK,
  LOOK_PITCH,
  PITCH,
  WALK_FOV,
  WALK_NEAR,
  WHEEL,
  lookRotation,
  startCameraMove,
  stepCameraMove,
  walkCameraPose,
  type CameraMove,
  type WalkView,
} from "./walkCamera";

export { nearestAhead, stepWalker, type Walker, type WalkInput } from "./walkPhysics";

/** Whether the walk looks out of the figure's eyes, remembered while the window is open. */
let lastFirst = true;
/** How long sitting down and standing up move the camera, in milliseconds. */
const SIT_MS = 900;
const RISE_MS = 750;

/**
 * Where the person stood in each building and how they looked, so leaving the building to sit at a
 * computer and coming back puts them where they were. Kept while the window is open.
 */
const walkMemory = new Map<string, { walker: Walker; view: WalkView }>();

export type { ComputerView } from "./building";

/** The camera's height of view for a walk view: wide out of the eyes, narrower over the shoulder. */
const fovOf = (view: WalkView) => (view.first ? FIRST_FOV : WALK_FOV);

/**
 * The camera's pose at a computer: straight in front of its glass, as far back as puts the glass
 * on the box the real pages are laid over in a view of `size` (deskScreenRect), so they lie on
 * the screen in the room. `fov` is the camera's height of view, in degrees.
 */
function screenPose(view: ComputerView, fov: number, size: { width: number; height: number }) {
  const glass = deskGlass[view.place];
  const box = deskScreenRect(view.place, size.width, size.height);
  // CSS pixels to a scene unit on the glass, and how far back the camera is for that.
  const scale = box.height / glass.h;
  const distance = size.height / (2 * Math.tan((fov * Math.PI) / 360) * scale);
  const facing = new Vector3(view.facing.x, view.facing.y, view.facing.z).normalize();
  const up = new Vector3(view.up.x, view.up.y, view.up.z).normalize();
  const right = new Vector3().crossVectors(up, facing);
  // The box's middle sits off the view's middle (the band and the dock are not the same height),
  // so the camera steps along the glass by as much: it stays square on, the glass a rectangle.
  const down = box.top + box.height / 2 - size.height / 2;
  const across = box.left + box.width / 2 - size.width / 2;
  const position = new Vector3(view.screen.x, view.screen.y, view.screen.z)
    .addScaledVector(facing, distance)
    .addScaledVector(up, down / scale)
    .addScaledVector(right, -across / scale);
  const rotation = lookRotation(position, position.clone().sub(facing));
  return { position, rotation };
}

/**
 * Walk mode: the person is a figure in the room, walked through in first person, as an office is
 * walked through, or played over the shoulder. Dragging looks around (or turns the camera around
 * them), and the wheel goes from one to the other: out of the figure's head to behind it, and
 * nearer until it is back in its eyes. W, A, S and D or the arrows walk in every direction from
 * where the camera looks, and Space jumps. Furniture and walls stop the figure, and the camera
 * keeps inside the room, so everyone's work can be seen from among them. `/teleport` puts the
 * person somewhere else at once; sitting at a computer moves the camera into its screen, and
 * standing up moves it back out to where they were.
 */
export function Walk(props: {
  grid: NavGrid;
  /** The pieces' solid parts as drawn, which stop the person's figure. */
  solids: readonly Solid[];
  still: boolean;
  /** Where each figure is, kept current by the figures. */
  anchors: Map<string, Point>;
  /** Everyone on the floor: the person's figure walks round them, and they round it. */
  crowd: Crowd;
  /** What the person can walk up to: agents, members, free desks, the computers. */
  people: readonly string[];
  onNear?(id: string | null): void;
  /** What the person picked from the emote wheel, acted out by their figure for a moment. */
  emote?: { kind: StudioEmote; at: number } | null;
  /** Told whether the walk looks out of the figure's eyes, at the start and on every change. */
  onFirstPerson?(first: boolean): void;
  /** Whether the room may hold the pointer to look. Off while a panel needs the cursor. */
  freeLook?: boolean;
  /** Which building this is, so the person comes back to where they stood in it. */
  memory: string;
  /** A jump to somewhere else in the building, made once for each `at`. */
  teleport?: { x: number; z: number; yaw: number; at: number } | null;
  /** Sitting down at a computer: the camera moves into its screen, then `onSat` is told. */
  sitting?: ComputerView | null;
  onSat?(): void;
  /** Back from a computer: the camera starts in its screen and moves out to the person. */
  risingFrom?: ComputerView | null;
  /** Who the person is, which settles their character until they pick one. */
  who: string;
  /** How the person's own figure looks, as they dressed it. */
  look?: { model?: string } & FigureColors;
}) {
  const { still, crowd } = props;
  const grid = useMemo(() => withChairs(props.grid), [props.grid]);
  const freeLook = Boolean(props.freeLook) && !props.sitting;
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const getScene = useThree((state) => state.get);
  const setEvents = useThree((state) => state.setEvents);
  const figure = useRef<Group>(null);
  const motion = useRef<PersonMotion>({ speed: 0, airborne: false, rising: 0, emote: null });
  const held = useRef(new Set<Move>());
  const near = useRef<string | null>(null);
  const onNear = useRef(props.onNear);
  onNear.current = props.onNear;
  const remembered = walkMemory.get(props.memory);
  const state = useRef<Walker | null>(null);
  if (!state.current) {
    // Where they stood before, else in by the door, looking into the room.
    const start = nearestWalkable(grid, { x: 3, z: 10 }) ?? { x: 3, z: 10 };
    state.current = remembered
      ? { ...remembered.walker }
      : standingWalker(cellCenter(start), Math.PI / 2);
  }
  // The camera starts looking the way the figure faces: out of its eyes, or from behind it.
  const view = useRef<WalkView>(
    remembered
      ? { ...remembered.view }
      : {
          yaw: -Math.PI / 2,
          pitch: lastFirst ? LOOK_PITCH.start : PITCH.start,
          distance: DISTANCE.start,
          first: lastFirst,
        },
  );
  const onFirstPerson = useRef(props.onFirstPerson);
  onFirstPerson.current = props.onFirstPerson;
  // Read by the pointer handlers through a ref, so a change in Settings never rebinds them.
  const studioCamera = useStudioCamera();
  const cameraSettings = useRef(studioCamera);
  cameraSettings.current = studioCamera;
  useEffect(() => onFirstPerson.current?.(view.current.first), []);

  const { memory } = props;
  useEffect(
    () => () => {
      if (near.current) onNear.current?.(null);
      crowd.delete(ME);
      walkView.active = false;
      const self = state.current;
      if (self)
        walkMemory.set(memory, {
          walker: { ...self, vx: 0, vz: 0, vy: 0, y: 0 },
          view: { ...view.current },
        });
    },
    [crowd, memory],
  );

  const eye = useRef(new Vector3());
  const look = useRef(new Vector3());
  /** Whether the camera has been put in place once: until then it jumps there, not glides. */
  const settled = useRef(false);

  // A teleport lands the person on free floor at once, looking the way it says.
  const lastTeleport = useRef(props.teleport?.at ?? 0);
  useEffect(() => {
    const jump = props.teleport;
    const self = state.current;
    if (!jump || !self || jump.at === lastTeleport.current) return;
    lastTeleport.current = jump.at;
    Object.assign(self, standingWalker({ x: jump.x, z: jump.z }, jump.yaw));
    view.current.yaw = jump.yaw + Math.PI;
    settled.current = false;
  }, [props.teleport]);

  useEffect(() => {
    // The Walk button keeps focus after it is pressed, and Space would press it again.
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    const down = (event: KeyboardEvent) => {
      const move = moveKeys[event.code];
      if (!move || typingIn(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      held.current.add(move);
    };
    const up = (event: KeyboardEvent) => {
      const move = moveKeys[event.code];
      if (move) held.current.delete(move);
    };
    const drop = () => held.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", drop);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", drop);
    };
  }, []);

  useEffect(() => {
    // A free camera, as a game's is: a click into the room holds the pointer, and from then on
    // the mouse turns the camera with no button down until Escape lets it go. The wheel moves it
    // in and out.
    // The click that takes hold of the pointer only does that: it picks nothing in the room.
    let grabbing = false;
    const press = (event: PointerEvent) => {
      grabbing = false;
      if (!freeLook || event.pointerType !== "mouse" || holdingPointer(canvas)) return;
      grabbing = true;
      holdPointer(canvas);
    };
    const click = (event: MouseEvent) => {
      if (!grabbing) return;
      grabbing = false;
      event.stopPropagation();
    };
    const move = (event: PointerEvent) => {
      if (!holdingPointer(canvas)) return;
      const turn = view.current;
      const limits = turn.first ? LOOK_PITCH : PITCH;
      const { sensitivity, invert } = cameraSettings.current;
      const rate = LOOK * sensitivity;
      turn.yaw -= event.movementX * rate;
      turn.pitch = Math.min(
        limits.most,
        Math.max(limits.least, turn.pitch + event.movementY * rate * (invert ? -1 : 1)),
      );
    };
    const leave = () => releasePointer(canvas);
    // Escape gives the cursor back. A web view's own lock does that by itself; a cursor the
    // window grabbed is let go here, before Escape does anything else in the studio.
    const escape = (event: KeyboardEvent) => {
      if (event.code !== "Escape" || !holdingPointer(canvas)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      releasePointer(canvas);
    };
    window.addEventListener("keydown", escape, true);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const turn = view.current;
      const switchTo = (first: boolean) => {
        turn.first = lastFirst = first;
        turn.pitch = first ? LOOK_PITCH.start : PITCH.start;
        onFirstPerson.current?.(first);
      };
      if (turn.first) {
        // Wheeled out of the eyes, the camera steps back behind the figure.
        if (event.deltaY <= 0) return;
        turn.distance = DISTANCE.least;
        switchTo(false);
        return;
      }
      const next = turn.distance * Math.exp(event.deltaY * WHEEL * cameraSettings.current.zoom);
      // Wheeled in past the nearest over the shoulder, it goes into the figure's eyes.
      if (next < DISTANCE.least && event.deltaY < 0) return switchTo(true);
      turn.distance = Math.min(DISTANCE.most, Math.max(DISTANCE.least, next));
    };
    const menu = (event: MouseEvent) => event.preventDefault();
    canvas.addEventListener("pointerdown", press);
    canvas.addEventListener("click", click);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("contextmenu", menu);
    window.addEventListener("pointermove", move);
    window.addEventListener("blur", leave);
    return () => {
      window.removeEventListener("keydown", escape, true);
      window.removeEventListener("blur", leave);
      releasePointer(canvas);
      canvas.removeEventListener("pointerdown", press);
      canvas.removeEventListener("click", click);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("contextmenu", menu);
      window.removeEventListener("pointermove", move);
    };
  }, [canvas, freeLook]);

  useEffect(() => {
    // While the pointer is held, the cursor stands still wherever it was, so clicks and hovers aim
    // where the crosshair is instead: the middle of the view.
    const before = getScene().events.compute;
    setEvents({
      compute(event, state, previous) {
        if (!holdingPointer(canvas)) return before?.(event, state, previous);
        state.pointer.set(0, 0);
        state.raycaster.setFromCamera(state.pointer, state.camera);
      },
    });
    return () => setEvents({ compute: before });
  }, [canvas, getScene, setEvents]);

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const before = { fov: camera.fov, near: camera.near };
    camera.fov = view.current.first ? FIRST_FOV : WALK_FOV;
    camera.near = WALK_NEAR;
    camera.updateProjectionMatrix();
    return () => {
      camera.fov = before.fov;
      camera.near = before.near;
      camera.updateProjectionMatrix();
    };
  }, [camera]);

  /** The camera's move into a screen, or back out of one, while it plays. */
  const cameraMove = useRef<{ move: CameraMove; done?: () => void } | null>(null);
  const sat = useRef(false);
  // Back from a computer, the camera starts in its screen and moves out to the person.
  const { risingFrom } = props;
  const rose = useRef(false);
  useEffect(() => {
    if (!risingFrom || rose.current) return;
    rose.current = true;
    const from = screenPose(risingFrom, fovOf(view.current), getScene().size);
    camera.position.copy(from.position);
    camera.quaternion.copy(from.rotation);
    settled.current = true;
    const self = state.current;
    if (!self) return;
    walkCameraPose(self, view.current, eye.current, look.current);
    const to = {
      position: eye.current.clone(),
      rotation: lookRotation(eye.current, look.current, new Quaternion()),
    };
    cameraMove.current = {
      move: startCameraMove(camera, to, still ? 0 : RISE_MS, performance.now()),
    };
  }, [camera, getScene, risingFrom, still]);
  // Sitting down, the person stops and the camera moves into the screen.
  const { sitting, onSat } = props;
  useEffect(() => {
    if (!sitting) return;
    held.current.clear();
    releasePointer(canvas);
    sat.current = false;
    cameraMove.current = {
      move: startCameraMove(
        camera,
        screenPose(sitting, fovOf(view.current), getScene().size),
        still ? 0 : SIT_MS,
        performance.now(),
      ),
      done: () => {
        if (sat.current) return;
        sat.current = true;
        onSat?.();
      },
    };
  }, [camera, canvas, getScene, sitting, onSat, still]);

  useFrame(({ size }, delta) => {
    const self = state.current;
    if (!self) return;
    const step = Math.min(delta, 0.05);
    const turn = view.current;
    if (!props.sitting) {
      // Furniture and walls stop the figure, and so does everyone else in the room.
      const from = { x: self.x, z: self.z };
      stepWalker(
        self,
        { held: held.current, cameraYaw: turn.yaw },
        step,
        (at) => bodyClear(props.solids, at) && clearOf(ME, crowd, at, from),
      );
    }
    // Looking out of the figure's eyes, it faces where they look, which is who it talks to.
    if (turn.first) self.yaw = turn.yaw + Math.PI;
    crowd.set(ME, { x: self.x, z: self.z, moving: Math.hypot(self.vx, self.vz) > 0.05 });
    const speed = Math.hypot(self.vx, self.vz) / SPEED;
    const emote = props.emote ?? null;
    motion.current = {
      speed,
      airborne: self.y > 0,
      rising: self.vy,
      emote: emote && speed < 0.1 && self.y === 0 && !still ? emote : null,
    };
    if (figure.current) {
      figure.current.position.set(self.x, self.y, self.z);
      figure.current.rotation.y = self.yaw;
      // Out of its own eyes the figure isn't drawn, nor does it throw a shadow in the way.
      figure.current.visible = !turn.first && !props.sitting;
    }

    if (camera instanceof PerspectiveCamera) {
      const fov = turn.first ? FIRST_FOV : WALK_FOV;
      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }
    walkCameraPose(self, turn, eye.current, look.current);
    // Inside walls between the camera and the figure get out of the way; out of the eyes,
    // nothing stands between them and themselves, so every inside wall stays up.
    walkView.active = true;
    walkView.target.copy(turn.first ? eye.current : look.current);
    const playing = cameraMove.current;
    if (playing) {
      if (stepCameraMove(camera, playing.move, performance.now())) {
        cameraMove.current = null;
        playing.done?.();
      }
    } else if (props.sitting) {
      // Sat down, the camera stays square on the screen, keeping its glass under the pages as
      // the window changes size.
      const pose = screenPose(props.sitting, fovOf(turn), size);
      camera.position.copy(pose.position);
      camera.quaternion.copy(pose.rotation);
    } else if (turn.first || !settled.current || still) {
      camera.position.copy(eye.current);
      camera.lookAt(look.current);
      settled.current = true;
    } else {
      camera.position.lerp(eye.current, Math.min(1, step * 14));
      camera.lookAt(look.current);
    }

    const nearest = props.sitting ? null : nearestAhead(self, props.people, props.anchors);
    if (nearest !== near.current) {
      near.current = nearest;
      onNear.current?.(nearest);
    }
  });

  const start = state.current;
  return (
    <group ref={figure} position={[start.x, 0, start.z]} rotation={[0, start.yaw, 0]}>
      <PersonFigure motion={motion} still={still} who={props.who} look={props.look} />
    </group>
  );
}
