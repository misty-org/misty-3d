import type { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ComponentRef } from "react";
import { PerspectiveCamera, type Vector3 } from "three";
import type { RoomSize } from "./grid";
import { holdingPointer, pointerHold, releasePointer } from "./pointerLock";

/** Where the overview camera looks, and the direction it looks from. */
export const TARGET: [number, number, number] = [0, 0.4, 0.6];
const VIEW = { x: 0.6, y: 0.62, z: 0.7 };

export type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;

/** How much bigger than the smallest room this one is, which the camera and the light follow. */
export const roomScale = (size: RoomSize) => Math.max(size.w / 20, size.d / 13);

/** Sets the camera back far enough to take in the whole room, whatever shape the page is. */
export function Framing({ size }: { size: RoomSize }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;
  const aspect = useThree((state) => state.size.width / Math.max(1, state.size.height));
  const framed = useRef("");
  useEffect(() => {
    const room = `${size.w}x${size.d}`;
    if (framed.current === room || !controls) return;
    framed.current = room;
    const far = 27 * roomScale(size) * Math.max(1, 1.9 / aspect);
    const length = Math.hypot(VIEW.x, VIEW.y, VIEW.z);
    camera.position.set(
      TARGET[0] + (VIEW.x / length) * far,
      TARGET[1] + (VIEW.y / length) * far,
      TARGET[2] + (VIEW.z / length) * far,
    );
    controls.update();
  }, [aspect, camera, controls, size]);
  return null;
}

/**
 * Keeps the overview's depth sharp: the camera's nearest drawn distance follows how far it is from
 * what it looks at. Close up a small one keeps nearby pieces whole; from across the room a larger
 * one gives the flat layers on the floor (rugs, marks, the grid) depths of their own, where they
 * would otherwise trade places from frame to frame and flicker.
 */
export function OverviewDepth() {
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;
  useFrame(({ camera }) => {
    if (!(camera instanceof PerspectiveCamera) || !controls) return;
    const away = camera.position.distanceTo(controls.target);
    const near = Math.min(4, Math.max(0.5, away * 0.05));
    if (Math.abs(camera.near - near) / near < 0.05) return;
    camera.near = near;
    camera.updateProjectionMatrix();
  });
  return null;
}

/** What of OrbitControls' insides turning by raw mouse movement reaches. */
interface OrbitInsides {
  enabled: boolean;
  state: number;
  rotateSpeed: number;
  panSpeed: number;
  _rotateLeft(angle: number): void;
  _rotateUp(angle: number): void;
  _pan(x: number, y: number): void;
  update(): boolean;
}
const ORBIT = { rotate: 0, pan: 2 };

/**
 * Turning or panning the overview keeps going however far the mouse travels: the pointer is held
 * while a button is down, and its raw movement turns the camera as OrbitControls would have from
 * the pointer's place, which stops changing once it is held. Off in build mode, where a drag
 * moves furniture under the pointer. Inverted, the mouse going up tilts the camera down.
 */
export function EndlessOrbit(props: { enabled: boolean; invert: boolean }) {
  const canvas = useThree((state) => state.gl.domElement);
  const controls = useThree((state) => state.controls) as unknown as OrbitInsides | null;
  useEffect(() => {
    if (!props.enabled) return;
    const hold = pointerHold(canvas);
    const press = (event: PointerEvent) => hold.press(event);
    const move = (event: PointerEvent) => {
      hold.move(event);
      if (!controls?.enabled || !holdingPointer(canvas)) return;
      if (typeof controls._rotateLeft !== "function") return;
      const height = canvas.clientHeight || 1;
      if (controls.state === ORBIT.rotate) {
        controls._rotateLeft(((2 * Math.PI * event.movementX) / height) * controls.rotateSpeed);
        const tilt = props.invert ? -event.movementY : event.movementY;
        controls._rotateUp(((2 * Math.PI * tilt) / height) * controls.rotateSpeed);
      } else if (controls.state === ORBIT.pan) {
        controls._pan(event.movementX * controls.panSpeed, event.movementY * controls.panSpeed);
      } else return;
      controls.update();
    };
    const release = () => hold.release();
    canvas.addEventListener("pointerdown", press);
    document.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    window.addEventListener("blur", release);
    return () => {
      canvas.removeEventListener("pointerdown", press);
      document.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("blur", release);
      releasePointer(canvas);
    };
  }, [canvas, controls, props.enabled, props.invert]);
  return null;
}

/** Brings the camera over to a figure when it is picked, unless the person is steering already. */
export function Follow(props: {
  id: string | null;
  anchors: Map<string, Vector3>;
  still: boolean;
}) {
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;
  const camera = useThree((state) => state.camera);
  const going = useRef(false);
  useEffect(() => {
    going.current = Boolean(props.id);
  }, [props.id]);
  useEffect(() => {
    if (!controls) return;
    const stop = () => (going.current = false);
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);
  useFrame((_, delta) => {
    const anchor = props.id ? props.anchors.get(props.id) : undefined;
    if (!going.current || !anchor || !controls) return;
    const dx = anchor.x - controls.target.x;
    const dz = anchor.z - controls.target.z;
    const ease = props.still ? 1 : Math.min(1, delta * 4);
    controls.target.x += dx * ease;
    controls.target.z += dz * ease;
    camera.position.x += dx * ease;
    camera.position.z += dz * ease;
    if (Math.hypot(dx, dz) < 0.05) going.current = false;
  });
  return null;
}
