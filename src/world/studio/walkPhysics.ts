import { GRID, facing, type Point } from "./grid";
import type { Solid } from "./layout";
import { turnToward } from "./motion";
import type { NavGrid } from "./pathfinding";

/** Top walking speed in scene units a second, and how quickly it is reached and lost. */
export const SPEED = 4.2;
const GRIP = 14;
/** How hard a jump leaves the floor, and how hard the room pulls back down. */
export const JUMP = 5.4;
const GRAVITY = 17;
/** How fast the figure turns to face the way it walks, in radians a second. */
const TURN = 12;
/** How far from the middle of a figure nothing solid may be. */
const GIRTH = 0.28;
/** How near an agent the person must walk, in scene units, to talk to it. */
const TALKING_DISTANCE = 1.8;

export type Move = "ahead" | "back" | "left" | "right" | "jump";

/** The keys that walk, as a game's do: WASD or the arrows, and Space to jump. */
export const moveKeys: Record<string, Move> = {
  KeyW: "ahead",
  ArrowUp: "ahead",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "jump",
};

/**
 * Whether the figure's whole body, round, is inside the room and clear of every solid piece as it
 * is drawn, so the person walks right up to a desk and round its chair, not to the edge of the
 * cells they stand in.
 */
export function bodyClear(solids: readonly Solid[], at: Point): boolean {
  if (Math.abs(at.x) > GRID.w / 2 - GIRTH || Math.abs(at.z) > GRID.d / 2 - GIRTH) return false;
  for (const solid of solids) {
    if ("r" in solid) {
      if (Math.hypot(at.x - solid.x, at.z - solid.z) < solid.r + GIRTH) return false;
      continue;
    }
    // The nearest point of the box to the figure's middle.
    const nx = Math.max(solid.x - solid.w / 2, Math.min(at.x, solid.x + solid.w / 2));
    const nz = Math.max(solid.z - solid.d / 2, Math.min(at.z, solid.z + solid.d / 2));
    if (Math.hypot(at.x - nx, at.z - nz) < GIRTH) return false;
  }
  return true;
}

/** The floor as the person's figure finds it: chairs are in the way too, since it never sits. */
export function withChairs(grid: NavGrid): NavGrid {
  if (!grid.seats) return grid;
  const blocked = grid.blocked.slice();
  grid.seats.forEach((seat, index) => {
    if (seat) blocked[index] = 1;
  });
  return { blocked };
}

/** The person's figure: where it stands, how high it is off the floor, and how it is moving. */
export interface Walker {
  x: number;
  z: number;
  /** Height of the feet over the floor; 0 on the floor. */
  y: number;
  yaw: number;
  vx: number;
  vz: number;
  vy: number;
  stride: number;
}

/** The keys held, and which way the camera looks along the floor (its yaw). */
export interface WalkInput {
  held: ReadonlySet<Move>;
  cameraYaw: number;
}

/**
 * One step of walking, as in a game played over the shoulder: the keys move the figure relative to
 * the camera, W away from it, S toward it, A and D to the sides, and together on a slant. Speed
 * builds and falls off quickly rather than at once, the figure turns to face where it goes, Space
 * jumps when it is on the floor, and furniture and walls stop it, each axis on its own so it slides
 * along them instead of sticking.
 */
export function stepWalker(
  self: Walker,
  input: WalkInput,
  seconds: number,
  canStand: (at: Point) => boolean,
): void {
  const on = (move: Move) => (input.held.has(move) ? 1 : 0);
  // Away from the camera along the floor, and to its right.
  const ahead = { x: -Math.sin(input.cameraYaw), z: -Math.cos(input.cameraYaw) };
  const right = { x: -ahead.z, z: ahead.x };
  const forward = on("ahead") - on("back");
  const side = on("right") - on("left");
  let wantX = ahead.x * forward + right.x * side;
  let wantZ = ahead.z * forward + right.z * side;
  const length = Math.hypot(wantX, wantZ);
  if (length > 0) [wantX, wantZ] = [(wantX / length) * SPEED, (wantZ / length) * SPEED];
  // Less grip in the air, so a jump carries on the way it was going.
  const grip = Math.min(1, seconds * (self.y > 0 ? GRIP / 4 : GRIP));
  self.vx += (wantX - self.vx) * grip;
  self.vz += (wantZ - self.vz) * grip;
  if (Math.abs(self.vx) < 1e-3) self.vx = 0;
  if (Math.abs(self.vz) < 1e-3) self.vz = 0;

  const alongX = { x: self.x + self.vx * seconds, z: self.z };
  if (canStand(alongX)) self.x = alongX.x;
  else self.vx = 0;
  const alongZ = { x: self.x, z: self.z + self.vz * seconds };
  if (canStand(alongZ)) self.z = alongZ.z;
  else self.vz = 0;

  if (on("jump") && self.y === 0 && self.vy === 0) self.vy = JUMP;
  self.vy -= GRAVITY * seconds;
  self.y += self.vy * seconds;
  if (self.y <= 0) [self.y, self.vy] = [0, 0];

  const speed = Math.hypot(self.vx, self.vz);
  if (length > 0) self.yaw = turnToward(self.yaw, Math.atan2(wantX, wantZ), seconds * TURN);
  if (self.y === 0) self.stride += speed * seconds;
}

/** The agent nearest the person and in front of them, within talking distance, if any. */
export function nearestAhead(
  self: { x: number; z: number; yaw: number },
  people: readonly string[],
  anchors: Map<string, Point>,
): string | null {
  const way = facing(self.yaw);
  let best: string | null = null;
  let bestScore = Infinity;
  for (const id of people) {
    const at = anchors.get(id);
    if (!at) continue;
    const dx = at.x - self.x;
    const dz = at.z - self.z;
    const distance = Math.hypot(dx, dz);
    if (distance > TALKING_DISTANCE) continue;
    // Someone behind the person isn't who they are talking to.
    const ahead = distance < 0.4 ? 1 : (dx * way.x + dz * way.z) / distance;
    if (ahead < 0.2) continue;
    const score = distance * (2 - ahead);
    if (score < bestScore) [best, bestScore] = [id, score];
  }
  return best;
}

/** A walker standing still at `at`, facing `yaw`. */
export const standingWalker = (at: Point, yaw: number): Walker => ({
  x: at.x,
  z: at.z,
  y: 0,
  yaw,
  vx: 0,
  vz: 0,
  vy: 0,
  stride: 0,
});
