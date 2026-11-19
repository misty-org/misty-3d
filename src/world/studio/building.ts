import { furniture, type FurnitureKind } from "./catalog";
import {
  DOOR,
  GRID,
  applyRoomSize,
  cellCenter,
  cellOf,
  rotateOffset,
  yawToward,
  type Cell,
  type Point,
  type Rot,
} from "./grid";
import { canPlace, itemCenter, itemPoint, type StudioItem, type StudioLayout } from "./layout";
import { nearestWalkable, type NavGrid } from "./pathfinding";

/**
 * Game mode's building is the studio's floor: its rooms are where things already stand. Each room
 * is found by the piece it is built round, wherever the person moved it, so `/teleport`, the hotbar
 * and where teammates are seen all keep working in a rearranged building.
 */
export const roomIds = [
  "desk",
  "office",
  "meeting",
  "lounge",
  "library",
  "arcade",
  "door",
] as const;
export type RoomId = (typeof roomIds)[number];

export const isRoomId = (value: unknown): value is RoomId =>
  typeof value === "string" && (roomIds as readonly string[]).includes(value);

/** Each room's name, as the hotbar, `/teleport` and a teammate's tag say it. */
export const roomNames: Record<RoomId, string> = {
  desk: "Your desk",
  office: "Agent floor",
  meeting: "Meeting room",
  lounge: "Lounge",
  library: "Library",
  arcade: "Arcade",
  door: "Front door",
};

/** The pieces a room is built round, the first one found deciding where it is. */
const anchorKinds: Record<Exclude<RoomId, "door" | "office">, FurnitureKind[]> = {
  desk: ["workstation"],
  meeting: ["table", "screen"],
  lounge: ["sofa", "armchair", "beanbag"],
  library: ["reading-desk", "bookshelf"],
  arcade: ["arcade", "vending"],
};

/**
 * Where a desk's monitor is, before the piece is turned: the middle of the screen, from the middle
 * of the desk's footprint. Sitting down, the camera moves in until this screen fills the view.
 */
export const MONITOR = { x: 0, y: 1.0, z: -0.74 } as const;

/** The person's desk's big screen, before the piece is turned: a little left of the desk's middle,
 * straight at the chair, its glass `deskGlass.desk` a step in front of the monitor's middle. */
export const DESK_SCREEN = { x: -0.12, glass: 0.025 } as const;

/** The library desk's laptop, before the piece is turned: where its lid hinges, how far it leans
 * back (a turn about its hinge), and where its glass is on the lid. */
export const LAPTOP = { y: 0.66, z: -0.55, lean: -0.25, glassY: 0.17, glassZ: 0.012 } as const;

/** The games corner's rug in a new building, where what the building earns is put. */
const GAMES_CORNER = "rug-5";

/** The two computers the person sits down at. */
export type SeatPlace = "desk" | "library";
const seatKinds: Record<SeatPlace, FurnitureKind> = {
  desk: "workstation",
  library: "reading-desk",
};

/** Where a room's middle is, from the piece it is built round. */
export function roomCenters(items: readonly StudioItem[]): Map<RoomId, Point> {
  const centers = new Map<RoomId, Point>();
  for (const [room, kinds] of Object.entries(anchorKinds) as [RoomId, FurnitureKind[]][]) {
    for (const kind of kinds) {
      const found = items.find((item) => item.kind === kind);
      if (!found) continue;
      centers.set(room, itemCenter(found));
      break;
    }
  }
  // Before its first cabinet is earned, the arcade is the games corner, round its rug.
  const corner = items.find((item) => item.id === GAMES_CORNER);
  if (!centers.has("arcade") && corner) centers.set("arcade", itemCenter(corner));
  // The agent floor is round its desks: the desk nearest their middle.
  const desks = items.filter((item) => item.kind === "desk").map(itemCenter);
  if (desks.length) {
    const mid = {
      x: desks.reduce((sum, at) => sum + at.x, 0) / desks.length,
      z: desks.reduce((sum, at) => sum + at.z, 0) / desks.length,
    };
    const nearest = desks.reduce((best, at) =>
      Math.hypot(at.x - mid.x, at.z - mid.z) < Math.hypot(best.x - mid.x, best.z - mid.z)
        ? at
        : best,
    );
    centers.set("office", nearest);
  }
  centers.set("door", cellCenter({ x: 2, z: DOOR.z }));
  return centers;
}

/** A place to stand and which way to face. */
export interface Stand extends Point {
  yaw: number;
}

/** The free floor nearest `goal`, looking toward `look`; null on a floor with no free cell. */
function standNear(grid: NavGrid, goal: Point, look: Point): Stand | null {
  const cell = nearestWalkable(grid, cellOf(goal));
  if (!cell) return null;
  const at = cellCenter(cell);
  return { ...at, yaw: yawToward(at, look) };
}

/** In front of a seat's piece, a step back from its chair, looking at its desk. */
function beforeSeat(item: StudioItem, grid: NavGrid): Stand | null {
  const front = itemPoint(item, { x: 0, z: 1.25 });
  return standNear(grid, front, itemCenter(item));
}

/**
 * Where `/teleport` lands the person in each room: on free floor by what the room is built round,
 * facing it. At the person's desk and the reading desk, a step behind the chair.
 */
export function roomStands(items: readonly StudioItem[], grid: NavGrid): Map<RoomId, Stand> {
  const stands = new Map<RoomId, Stand>();
  const centers = roomCenters(items);
  for (const [room, center] of centers) {
    const seat = room === "desk" || room === "library" ? seatOf(items, room) : undefined;
    const stand =
      (seat && beforeSeat(seat, grid)) ??
      (room === "door"
        ? standNear(grid, center, { x: center.x + 1, z: center.z })
        : standNear(grid, center, center));
    if (stand) stands.set(room, stand);
  }
  return stands;
}

/** The room nearest a place on the floor: where a figure standing there is. */
export function roomAt(at: Point, centers: Map<RoomId, Point>): RoomId | null {
  let best: RoomId | null = null;
  let bestGap = Infinity;
  for (const [room, center] of centers) {
    const gap = Math.hypot(center.x - at.x, center.z - at.z);
    if (gap < bestGap) [best, bestGap] = [room, gap];
  }
  return best;
}

/** The piece the person sits at for one of their two computers. */
export function seatOf(items: readonly StudioItem[], place: SeatPlace): StudioItem | undefined {
  return items.find((item) => item.kind === seatKinds[place]);
}

/** A point in the scene, height included. */
export interface ScenePoint extends Point {
  y: number;
}

/**
 * A computer's glass where it stands in the scene: its middle, the way it faces (toward the chair)
 * and its up, which a laptop's lid leans back. Sitting down, the camera moves straight in front of
 * it until the glass fills the box the real pages are laid over (deskScreenRect).
 */
export interface ComputerView {
  place: SeatPlace;
  screen: ScenePoint;
  facing: ScenePoint;
  up: ScenePoint;
}

/** The glass of the computer at a seat: the desk's big screen, or the reading desk's laptop. */
export function computerView(item: StudioItem): ComputerView {
  const turned = (local: Point) => rotateOffset(local, item.rot);
  if (item.kind === seatKinds.library) {
    // Turned back about the hinge by the lid's lean.
    const cos = Math.cos(LAPTOP.lean);
    const sin = Math.sin(LAPTOP.lean);
    const middle = itemPoint(item, {
      x: 0,
      z: LAPTOP.z + LAPTOP.glassY * sin + LAPTOP.glassZ * cos,
    });
    return {
      place: "library",
      screen: { ...middle, y: LAPTOP.y + LAPTOP.glassY * cos - LAPTOP.glassZ * sin },
      facing: { ...turned({ x: 0, z: cos }), y: -sin },
      up: { ...turned({ x: 0, z: sin }), y: cos },
    };
  }
  const middle = itemPoint(item, { x: DESK_SCREEN.x, z: MONITOR.z + DESK_SCREEN.glass });
  return {
    place: "desk",
    screen: { ...middle, y: MONITOR.y },
    facing: { ...turned({ x: 0, z: 1 }), y: 0 },
    up: { x: 0, y: 1, z: 0 },
  };
}

/** Where the person stands to sit at a computer: their chair, which the walk prompt anchors on. */
export function chairOf(item: StudioItem): Point {
  const seat = furniture[item.kind].seats?.[0];
  return itemPoint(item, seat ?? { x: 0, z: 0.2 });
}

/** Origins worth trying for a piece, nearest `prefer` first. */
function originsNear(prefer: Cell): Cell[] {
  const all: Cell[] = [];
  for (let z = 0; z < GRID.d; z += 1) for (let x = 0; x < GRID.w; x += 1) all.push({ x, z });
  return all.sort(
    (a, b) =>
      Math.hypot(a.x - prefer.x, a.z - prefer.z) - Math.hypot(b.x - prefer.x, b.z - prefer.z),
  );
}

/** Where the two desks go in a building that lacks them: as the default building has them. */
const ownPieces: { id: string; kind: FurnitureKind; prefer: Cell }[] = [
  { id: "workstation", kind: "workstation", prefer: { x: 7, z: 3 } },
  { id: "reading-desk", kind: "reading-desk", prefer: { x: 0, z: 2 } },
];

/**
 * A building with the person's own desk and the library's reading desk: a studio arranged before
 * Game mode had them gets each in the free place nearest where a new building has it, turned
 * whichever way fits. A floor with no room for one goes on without it.
 */
export function furnishBuilding(layout: StudioLayout): StudioLayout {
  // Everything below is measured on this building's own floor.
  applyRoomSize(layout.size);
  let items = layout.items;
  for (const own of ownPieces) {
    if (items.some((item) => item.kind === own.kind)) continue;
    const taken = new Set(items.map((item) => item.id));
    const id = taken.has(own.id) ? `${own.id}-own` : own.id;
    found: for (const origin of originsNear(own.prefer)) {
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        const piece: StudioItem = { id, kind: own.kind, x: origin.x, z: origin.z, rot };
        if (!canPlace(items, piece)) continue;
        items = [...items, piece];
        break found;
      }
    }
  }
  return items === layout.items ? layout : { ...layout, items };
}
