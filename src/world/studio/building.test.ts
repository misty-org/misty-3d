import { describe, expect, it } from "vitest";
import {
  chairOf,
  computerView,
  furnishBuilding,
  roomAt,
  roomCenters,
  roomIds,
  roomStands,
  seatOf,
} from "./building";
import { applyRoomSize, cellOf } from "./grid";
import { canPlace, defaultLayout, itemCenter, type StudioLayout } from "./layout";
import { buildNavGrid, isWalkable } from "./pathfinding";

const fresh = defaultLayout();
const grid = buildNavGrid(fresh.items, fresh.size);

describe("the building", () => {
  it("has the person's own desk by the way in and a reading desk in the library", () => {
    const desk = seatOf(fresh.items, "desk");
    const reading = seatOf(fresh.items, "library");
    expect(desk?.kind).toBe("workstation");
    expect(reading?.kind).toBe("reading-desk");
    // The way in is the door in the left wall: the person's desk is a few steps from it.
    const door = roomCenters(fresh.items).get("door")!;
    const at = itemCenter(desk!);
    expect(Math.hypot(at.x - door.x, at.z - door.z)).toBeLessThan(9);
  });

  it("finds every room by what it is built round", () => {
    const centers = roomCenters(fresh.items);
    expect([...centers.keys()].sort()).toEqual([...roomIds].sort());
  });

  it("lands a teleport on free floor in every room, facing what the room is built round", () => {
    applyRoomSize(fresh.size);
    const stands = roomStands(fresh.items, grid);
    for (const room of roomIds) {
      const stand = stands.get(room);
      expect(stand, room).toBeDefined();
      expect(isWalkable(grid, cellOf(stand!)), room).toBe(true);
      expect(Number.isFinite(stand!.yaw)).toBe(true);
    }
  });

  it("knows which room someone standing somewhere is in", () => {
    const centers = roomCenters(fresh.items);
    for (const room of ["meeting", "lounge", "library"] as const)
      expect(roomAt(centers.get(room)!, centers)).toBe(room);
  });

  it("faces each computer's glass toward its chair, upright", () => {
    for (const place of ["desk", "library"] as const) {
      const item = seatOf(fresh.items, place)!;
      const { screen, facing, up } = computerView(item);
      const chair = chairOf(item);
      const toChair = { x: chair.x - screen.x, z: chair.z - screen.z };
      // The glass looks at the chair's side of the desk, and its up leans no further than a lid.
      expect(facing.x * toChair.x + facing.z * toChair.z, place).toBeGreaterThan(0);
      expect(Math.hypot(facing.x, facing.y, facing.z), place).toBeCloseTo(1);
      expect(up.y, place).toBeGreaterThan(0.9);
      expect(facing.x * up.x + facing.y * up.y + facing.z * up.z, place).toBeCloseTo(0);
    }
  });

  it("gives a building arranged before Game mode both desks, wherever they fit", () => {
    const old: StudioLayout = {
      ...fresh,
      items: fresh.items.filter(
        (item) => item.kind !== "workstation" && item.kind !== "reading-desk",
      ),
    };
    const furnished = furnishBuilding(old);
    expect(seatOf(furnished.items, "desk")).toBeDefined();
    expect(seatOf(furnished.items, "library")).toBeDefined();
    applyRoomSize(furnished.size);
    for (const item of furnished.items) expect(canPlace(furnished.items, item), item.id).toBe(true);
    // A building that has them is left as it is.
    expect(furnishBuilding(fresh)).toBe(fresh);
  });

  it("finds a place for the desks even in the smallest building", () => {
    const small = defaultLayout({ w: 20, d: 13 });
    const bare = {
      ...small,
      items: small.items.filter(
        (item) => item.kind !== "workstation" && item.kind !== "reading-desk",
      ),
    };
    const furnished = furnishBuilding(bare);
    expect(seatOf(furnished.items, "desk")).toBeDefined();
  });
});
