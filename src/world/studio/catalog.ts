import type { Point } from "./grid";

/**
 * How high a desk chair's seat is: low enough for the building's characters, whose legs are short,
 * to reach toward the floor, high enough that their hands meet the keyboard (`Chair`).
 */
export const DESK_SEAT = 0.3;

export const furnitureKinds = [
  "desk",
  "sofa",
  "armchair",
  "table",
  "coffee-table",
  "bookshelf",
  "screen",
  "plant",
  "lamp",
  "cooler",
  "rug",
  // Walls inside the room, which make it rooms: a gap between two is a doorway.
  "wall",
  // The person's own: their desk, whose computer opens their pages, and the library's reading
  // desk, whose computer opens the Lab (Game mode sits down at either).
  "workstation",
  "reading-desk",
  // Earned as the team gets work done (studioProgress.ts).
  "beanbag",
  "arcade",
  "aquarium",
  "trophies",
  "vending",
  "tree",
] as const;

export type FurnitureKind = (typeof furnitureKinds)[number];

/** A place to sit that comes with a piece, measured from the middle of its footprint before turning. */
interface Seat extends Point {
  /** Height of the seat's top. */
  y: number;
  /** The way the sitter looks, before the piece is turned. */
  yaw: number;
}

/**
 * A solid part of a piece as it is drawn, for the person's figure to walk up against: a box (its
 * middle and size) or a round (its middle and radius), measured from the middle of the footprint
 * before turning, as seats are.
 */
export type BodyShape =
  { x: number; z: number; w: number; d: number } | { x: number; z: number; r: number };

/** A desk's top and its chair, as `Desk`, `Workstation` and `ReadingDesk` draw them. */
const DESK_BODY: BodyShape[] = [
  { x: 0, z: -0.5, w: 1.9, d: 0.88 },
  { x: 0, z: 0.2, r: 0.28 },
];

interface FurnitureSpec {
  label: string;
  /** Cells across and deep before turning. */
  w: number;
  d: number;
  /** Rows from the back that cannot be walked through; the rest only keep other pieces away. */
  solidRows: number;
  /** Lies flat on the floor, so figures walk over it and other pieces stand on it. */
  flat?: boolean;
  seats?: Seat[];
  /** What stops the person's figure, as drawn. Without one, the solid rows do, cell for cell. */
  body?: BodyShape[];
  /** Figures gather on every side of it, or only in front of it, or not at all. */
  gather?: "around" | "front";
  /** The person's own: no agent sits at it or hangs about by it, and it can't be put away. */
  own?: boolean;
}

export const furniture: Record<FurnitureKind, FurnitureSpec> = {
  // A desk brings its chair: the back row is the desk, the front row is where the chair stands.
  desk: {
    label: "Desk",
    w: 2,
    d: 2,
    solidRows: 1,
    seats: [{ x: 0, z: 0.2, y: DESK_SEAT, yaw: Math.PI }],
    body: DESK_BODY,
  },
  sofa: {
    label: "Sofa",
    w: 2,
    d: 1,
    solidRows: 1,
    seats: [
      { x: -0.45, z: 0.08, y: 0.34, yaw: 0 },
      { x: 0.45, z: 0.08, y: 0.34, yaw: 0 },
    ],
  },
  armchair: {
    label: "Armchair",
    w: 1,
    d: 1,
    solidRows: 1,
    seats: [{ x: 0, z: 0.06, y: 0.34, yaw: 0 }],
  },
  table: {
    label: "Meeting table",
    w: 2,
    d: 2,
    solidRows: 2,
    gather: "around",
    body: [{ x: 0, z: 0, r: 0.98 }],
  },
  "coffee-table": { label: "Coffee table", w: 2, d: 1, solidRows: 1 },
  bookshelf: { label: "Bookshelf", w: 2, d: 1, solidRows: 1, gather: "front" },
  screen: { label: "Screen", w: 2, d: 1, solidRows: 1, gather: "front" },
  plant: { label: "Plant", w: 1, d: 1, solidRows: 1, gather: "front" },
  lamp: { label: "Lamp", w: 1, d: 1, solidRows: 1 },
  cooler: { label: "Water cooler", w: 1, d: 1, solidRows: 1, gather: "front" },
  rug: { label: "Rug", w: 4, d: 3, solidRows: 0, flat: true },
  wall: { label: "Wall", w: 4, d: 1, solidRows: 1, body: [{ x: 0, z: -0.2, w: 4, d: 0.22 }] },
  // Like a desk, its chair in front; the person sits at it to work at its computer.
  workstation: {
    label: "Your desk",
    w: 2,
    d: 2,
    solidRows: 1,
    seats: [{ x: 0, z: 0.2, y: DESK_SEAT, yaw: Math.PI }],
    body: DESK_BODY,
    own: true,
  },
  "reading-desk": {
    label: "Reading desk",
    w: 2,
    d: 2,
    solidRows: 1,
    seats: [{ x: 0, z: 0.2, y: DESK_SEAT, yaw: Math.PI }],
    body: DESK_BODY,
    own: true,
  },
  beanbag: {
    label: "Beanbag",
    w: 1,
    d: 1,
    solidRows: 1,
    seats: [{ x: 0, z: 0.04, y: 0.26, yaw: 0 }],
  },
  arcade: { label: "Arcade cabinet", w: 1, d: 1, solidRows: 1, gather: "front" },
  aquarium: { label: "Aquarium", w: 2, d: 1, solidRows: 1, gather: "front" },
  trophies: { label: "Trophy shelf", w: 2, d: 1, solidRows: 1, gather: "front" },
  vending: { label: "Snack machine", w: 1, d: 1, solidRows: 1, gather: "front" },
  tree: { label: "Indoor tree", w: 1, d: 1, solidRows: 1, gather: "front" },
};

export const isFurnitureKind = (value: unknown): value is FurnitureKind =>
  typeof value === "string" && (furnitureKinds as readonly string[]).includes(value);
