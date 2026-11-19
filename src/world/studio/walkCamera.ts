import { Matrix4, Quaternion, Vector3, type Camera } from "three";
import { GRID } from "./grid";
import type { Walker } from "./walkPhysics";

/** The camera over the shoulder: how far it comes out to from first person, how near and far it
 * may be wheeled, and its tilt. Wheeled in past `least`, it goes into the figure's head. */
export const DISTANCE = { start: 6.5, least: 2.2, most: 13 };
export const PITCH = { start: 0.42, least: 0.08, most: 1.25 };
/** Looking out of the figure's eyes: its tilt, down for positive, as over the shoulder. */
export const LOOK_PITCH = { start: 0.12, least: -1.2, most: 1.3 };
/** Where the eyes are, over the feet. */
export const HEAD = 1.12;
/** The view's width: wide from the eyes, as a game's first person is, narrower over the shoulder. */
export const FIRST_FOV = 72;
export const WALK_FOV = 50;
/** The nearest the camera draws: close enough not to cut into a desk walked up to. */
export const WALK_NEAR = 0.08;
/** Radians the camera turns per pixel the mouse moves, at the default camera sensitivity. */
export const LOOK = 0.0055;
/** How far one pixel of wheel moves the camera in or out, at the default zoom speed. */
export const WHEEL = 0.0015;
/** The point on the figure the camera looks at: about its shoulders. */
export const EYE = 1.15;

/** How the person looks around while walking: which way, how far down, and from where. */
export interface WalkView {
  yaw: number;
  pitch: number;
  distance: number;
  /** Out of the figure's own eyes, rather than over its shoulder. */
  first: boolean;
}

/** Where the camera wants to be for a walker and its view, and the point it looks at. */
export function walkCameraPose(self: Walker, view: WalkView, eye: Vector3, look: Vector3) {
  if (view.first) {
    // In the figure's head, held level as it walks, looking where the mouse turned it.
    eye.set(self.x, HEAD + self.y, self.z);
    const flat = Math.cos(view.pitch);
    look.set(
      eye.x - Math.sin(view.yaw) * flat,
      eye.y - Math.sin(view.pitch),
      eye.z - Math.cos(view.yaw) * flat,
    );
    return;
  }
  // On its sphere round the figure's shoulders, kept inside the walls where it can.
  const reach = (limit: number, value: number) => Math.min(limit, Math.max(-limit, value));
  const flat = Math.cos(view.pitch) * view.distance;
  eye.set(
    reach(GRID.w / 2 + 1.5, self.x + Math.sin(view.yaw) * flat),
    Math.max(0.6, EYE + self.y * 0.5 + Math.sin(view.pitch) * view.distance),
    reach(GRID.d / 2 + 1.5, self.z + Math.cos(view.yaw) * flat),
  );
  look.set(self.x, EYE + self.y * 0.5, self.z);
}

const scratch = new Matrix4();
const up = new Vector3(0, 1, 0);

/** Which way a camera at `from` turns to look at `to`. */
export function lookRotation(from: Vector3, to: Vector3, out = new Quaternion()): Quaternion {
  // Cameras look down their own -Z, as Object3D.lookAt has them.
  scratch.lookAt(from, to, up);
  return out.setFromRotationMatrix(scratch);
}

/** Slow at both ends, as a camera move should be. */
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * A camera move from one pose to another over `ms`: sitting down moves into a computer's screen
 * until it fills the view, standing up moves back out to where the person walks from.
 */
export interface CameraMove {
  from: { position: Vector3; rotation: Quaternion };
  to: { position: Vector3; rotation: Quaternion };
  start: number;
  ms: number;
}

/** Starts a move from wherever the camera is now. */
export function startCameraMove(
  camera: Camera,
  to: { position: Vector3; rotation: Quaternion },
  ms: number,
  now: number,
): CameraMove {
  return {
    from: { position: camera.position.clone(), rotation: camera.quaternion.clone() },
    to: { position: to.position.clone(), rotation: to.rotation.clone() },
    start: now,
    ms,
  };
}

/** Puts the camera where the move has got to; true once it has arrived. */
export function stepCameraMove(camera: Camera, move: CameraMove, now: number): boolean {
  const t = move.ms <= 0 ? 1 : Math.min(1, (now - move.start) / move.ms);
  const k = ease(t);
  camera.position.lerpVectors(move.from.position, move.to.position, k);
  camera.quaternion.slerpQuaternions(move.from.rotation, move.to.rotation, k);
  return t >= 1;
}
