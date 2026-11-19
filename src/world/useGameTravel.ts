import { useCallback, useMemo, useState } from "react";
import type { Vector3 } from "three";
import type { SeatPage, TeleportTarget } from "./gameCommands";
import { ME, type Crowd } from "./studio/crowd";
import { applyRoomSize, cellCenter, cellOf, yawToward, type Point } from "./studio/grid";
import { roomStands, seatOf, type SeatPlace, type Stand } from "./studio/building";
import type { StudioLayout } from "./studio/layout";
import { buildNavGrid, nearestWalkable } from "./studio/pathfinding";

/** How far from someone a teleport to them lands the person: a step away, facing them. */
const BESIDE = 1.1;

/**
 * Getting about the building without walking: a teleport to a room (landing by what it is built
 * round), to someone (a step from them, facing them) or to another building, and sitting down at
 * one of the person's two computers, going to it first.
 */
export function useGameTravel(input: {
  layout: StudioLayout | null;
  /** Where every figure is now, kept current by the scene. */
  anchors: Map<string, Vector3>;
  crowd: Crowd;
  /** Off while building or hiring, or once sitting down has begun. */
  enabled: boolean;
  onSit(place: SeatPlace, page?: SeatPage): void;
  onBuilding(id: string): void;
}) {
  const { layout, anchors, crowd, enabled, onSit, onBuilding } = input;
  const [teleport, setTeleport] = useState<(Stand & { at: number }) | null>(null);
  const grid = useMemo(() => {
    if (!layout) return null;
    applyRoomSize(layout.size);
    return buildNavGrid(layout.items, layout.size);
  }, [layout]);
  const stands = useMemo(
    () => (layout && grid ? roomStands(layout.items, grid) : null),
    [layout, grid],
  );
  const jump = useCallback((stand: Stand) => setTeleport({ ...stand, at: Date.now() }), []);

  const sit = useCallback(
    (place: SeatPlace, page?: SeatPage) => {
      if (!enabled || !layout || !seatOf(layout.items, place)) return;
      const before = stands?.get(place);
      if (before) jump(before);
      onSit(place, page);
    },
    [enabled, layout, stands, jump, onSit],
  );

  /** A step from someone, on free floor, on the person's side of them and facing them. */
  const beside = useCallback(
    (at: Point): Stand | null => {
      if (!grid || !layout) return null;
      applyRoomSize(layout.size);
      const me = crowd.get(ME) ?? at;
      const gap = Math.hypot(me.x - at.x, me.z - at.z) || 1;
      const goal = {
        x: at.x + ((me.x - at.x) / gap) * BESIDE,
        z: at.z + ((me.z - at.z) / gap) * BESIDE,
      };
      const cell = nearestWalkable(grid, cellOf(goal));
      if (!cell) return null;
      const spot = cellCenter(cell);
      return { ...spot, yaw: yawToward(spot, at) };
    },
    [grid, layout, crowd],
  );

  const goTo = useCallback(
    (target: TeleportTarget) => {
      if (target.kind === "building") return onBuilding(target.id);
      if (!enabled) return;
      if (target.kind === "seat") return sit(target.place, target.page);
      if (target.kind === "room") {
        const stand = stands?.get(target.room);
        if (stand) jump(stand);
        return;
      }
      const at = anchors.get(target.id);
      const stand = at ? beside(at) : null;
      if (stand) jump(stand);
    },
    [enabled, stands, anchors, beside, jump, sit, onBuilding],
  );

  return { teleport, goTo, sit };
}
