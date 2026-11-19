import { gridAround, stepThrough, type Crowd } from "../crowd";
import type { Point } from "../grid";
import { advanceWalker, type Walker } from "../motion";
import { routeTo, type NavGrid } from "../pathfinding";

/** Seconds held up, or walking without getting any nearer, before looking for another way round,
 * and before giving up and standing where it is; and how long it then waits to try again. Nobody
 * walks on the spot for good, and nobody is walked through. */
const HELD_REROUTE = 1;
const GIVE_UP = 2.5;
export const RETRY_AFTER = 8;
/** How much nearer, in scene units, counts as getting somewhere. */
const PROGRESS = 0.25;
/** How near its place a held-up figure must be to just stop there. */
const NEAR_ENOUGH = 0.9;

/** How a walk is going: seconds held up by someone in the way, and walking without getting
 * nearer; the nearest it has got to the end; whether it has tried another way; and seconds since
 * it gave up, or null while it hasn't. */
export interface Hold {
  for: number;
  stalled: number;
  best: number;
  rerouted: boolean;
  gaveUp: number | null;
}

export const freshHold = (): Hold => ({
  for: 0,
  stalled: 0,
  best: Infinity,
  rerouted: false,
  gaveUp: null,
});

/**
 * One step along a figure's route among everyone else: round whoever is in the way, never into
 * them. Held up, or getting no nearer, for long, it stops if it is nearly there, else looks for
 * another way round them, and failing that gives up and stands where it is for a while. Returns
 * how the walk goes on.
 */
export function walkAmong(
  self: Walker,
  step: number,
  speed: number,
  among: { id: string; crowd: Crowd; grid: NavGrid; held: Hold },
): Hold {
  const { id, crowd, grid } = among;
  let held = among.held;
  const from: Point = { x: self.x, z: self.z };
  const path = self.path.slice();
  const stride = self.stride;
  advanceWalker(self, step, speed);
  const { at, blocked } = stepThrough(id, from, self, crowd, grid);
  const end = path[path.length - 1];
  if (blocked) {
    [self.x, self.z, self.path, self.stride, self.moving] = [from.x, from.z, path, stride, true];
    held.for += step;
  } else {
    [self.x, self.z] = [at.x, at.z];
    held.for = 0;
    // Stepped aside at the very end of the route: it still has to get to its place.
    if (!self.path.length && end && Math.hypot(end.x - at.x, end.z - at.z) > 0.05) {
      self.path = [end];
      self.moving = true;
    }
  }
  if (!end) return held;
  const left = Math.hypot(end.x - self.x, end.z - self.z);
  if (left < held.best - PROGRESS) [held.best, held.stalled] = [left, 0];
  else held.stalled += step;
  const stuck = Math.max(held.for, held.stalled);
  if (stuck < HELD_REROUTE) return held;
  if (left < NEAR_ENOUGH) {
    // Close enough to count as there.
    [self.path, self.moving] = [[], false];
    held = freshHold();
  } else if (!held.rerouted) {
    const around = gridAround(grid, id, crowd, [self, end]);
    self.path = routeTo(around, self, end, end);
    held = { ...freshHold(), rerouted: true };
  } else if (stuck >= GIVE_UP) {
    [self.path, self.moving] = [[], false];
    held = { ...freshHold(), gaveUp: 0 };
  }
  return held;
}
