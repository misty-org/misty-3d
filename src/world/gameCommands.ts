import { roomIds, roomNames, type RoomId, type SeatPlace } from "./studio/building";
import { studioEmoteNames, type StudioEmote } from "./studioOrders";

/**
 * The building's `/` commands, typed in its chat box as in a game: `/teleport` (or `/tp`) to go
 * anywhere at once, `/sit` to sit at the person's desk, a page's own word (`/code`, `/calendar`,
 * `/docs`…) to sit down at its computer on that page, `/settings`, and `/e` (or the emote's own
 * name, as in `/dance`) to act one out. Walking is always optional: every place is a command away.
 */

/** A page a computer opens when the person sits down at it straight from `/teleport`. */
export type SeatPage =
  | "code"
  | "chats"
  | "calendar"
  | "planner"
  | "notes"
  | "slides"
  | "data"
  | "drawings"
  | "chat"
  | "lab"
  | "files";

/** Where `/teleport` can take the person. */
export type TeleportTarget =
  | { kind: "room"; room: RoomId }
  | { kind: "seat"; place: SeatPlace; page: SeatPage }
  | { kind: "figure"; id: string }
  | { kind: "building"; id: string };

/** One place `/teleport` offers: what it is called, a word on what it is, and where it goes. */
export interface TeleportPlace {
  key: string;
  label: string;
  detail: string;
  target: TeleportTarget;
  /** Other words it answers to, besides its label. */
  aliases: readonly string[];
}

const roomAliases: Record<RoomId, readonly string[]> = {
  desk: ["desk", "my desk", "home", "computer", "pc"],
  office: ["agents", "office", "floor", "team", "agent floor"],
  meeting: ["meeting", "meetings", "table", "huddle"],
  lounge: ["lounge", "break", "sofa", "couch", "rest"],
  library: ["library", "books", "reading"],
  arcade: ["arcade", "games", "game room", "play"],
  door: ["door", "exit", "entrance", "lobby", "outside", "leave"],
};

/** The pages a computer opens, by name: the person's desk for most, the library for the Lab. */
const pages: readonly { page: SeatPage; label: string; aliases: readonly string[] }[] = [
  { page: "code", label: "Code", aliases: ["editor", "project", "projects"] },
  { page: "chats", label: "New chat", aliases: ["chats", "new chat", "ask"] },
  { page: "calendar", label: "Calendar", aliases: ["schedule", "events"] },
  { page: "planner", label: "Planner", aliases: ["tasks", "board", "todo"] },
  { page: "notes", label: "Docs", aliases: ["docs", "documents", "notes", "journal"] },
  { page: "slides", label: "Slides", aliases: ["deck", "decks", "presentation", "presentations"] },
  {
    page: "data",
    label: "Data",
    aliases: ["workbook", "workbooks", "spreadsheet", "spreadsheets", "sheets", "charts"],
  },
  {
    page: "drawings",
    label: "Whiteboards",
    aliases: ["whiteboard", "whiteboards", "drawing", "drawings", "sketch"],
  },
  { page: "chat", label: "Space chat", aliases: ["chat", "messages", "everyone", "channels"] },
  { page: "lab", label: "Lab", aliases: ["notebooks", "notebook", "study", "learn"] },
  { page: "files", label: "Media", aliases: ["files", "library", "photos", "videos", "uploads"] },
];

/**
 * Each page's own `/` command and the other words it answers to: typing one sits the person down
 * at that page's computer, on it. Shown in this order while a `/` is typed.
 */
const pageCommands: readonly { page: SeatPage; command: string; words: readonly string[] }[] = [
  { page: "chats", command: "/new", words: ["new", "newchat", "ask"] },
  { page: "code", command: "/code", words: ["code", "editor"] },
  { page: "chat", command: "/chat", words: ["chat", "channels", "messages"] },
  { page: "notes", command: "/docs", words: ["docs", "doc", "notes"] },
  { page: "slides", command: "/slides", words: ["slides", "deck"] },
  { page: "data", command: "/data", words: ["data", "sheets", "workbooks"] },
  { page: "drawings", command: "/whiteboard", words: ["whiteboard", "whiteboards", "draw", "wb"] },
  { page: "planner", command: "/planner", words: ["planner", "tasks", "todo"] },
  { page: "calendar", command: "/calendar", words: ["calendar", "cal"] },
  { page: "lab", command: "/lab", words: ["lab", "notebooks"] },
  { page: "files", command: "/media", words: ["media", "files", "photos"] },
];

/** The computer a page is opened on. */
export const seatForPage = (page: SeatPage): SeatPlace =>
  page === "lab" || page === "files" ? "library" : "desk";

/** Everywhere `/teleport` can go now: the rooms, the pages, who is here, and the other buildings. */
export function teleportPlaces(input: {
  /** Figures in the building to go to: the person's agents and the teammates here. */
  figures: readonly { id: string; name: string; detail: string }[];
  /** The other Spaces the person can walk into. */
  buildings: readonly { id: string; name: string }[];
}): TeleportPlace[] {
  return [
    ...roomIds.map((room) => ({
      key: `room:${room}`,
      label: roomNames[room],
      detail: "Room",
      target: { kind: "room", room } as const,
      aliases: roomAliases[room],
    })),
    ...pages.map(({ page, label, aliases }) => ({
      key: `page:${page}`,
      label,
      detail: seatForPage(page) === "library" ? "Sit at the library" : "Sit at your desk",
      target: { kind: "seat", place: seatForPage(page), page } as const,
      aliases,
    })),
    ...input.figures.map((figure) => ({
      key: `figure:${figure.id}`,
      label: figure.name,
      detail: figure.detail,
      target: { kind: "figure", id: figure.id } as const,
      aliases: [],
    })),
    ...input.buildings.map((building) => ({
      key: `building:${building.id}`,
      label: building.name,
      detail: "Building",
      target: { kind: "building", id: building.id } as const,
      aliases: [],
    })),
  ];
}

const plain = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Words a destination is typed with that say nothing about which one it is. */
const filler = /^(?:to|the|my|your|a)\s+/;

/**
 * How well a place answers what was typed: 4 for its whole name, 3 for the start of it, 2 for the
 * start of any word in it, 1 for anywhere in it, 0 for not at all.
 */
function score(place: TeleportPlace, query: string): number {
  let best = 0;
  for (const name of [place.label, ...place.aliases].map(plain)) {
    if (name === query) return 4;
    if (name.startsWith(query)) best = Math.max(best, 3);
    else if (name.split(" ").some((word) => word.startsWith(query))) best = Math.max(best, 2);
    else if (name.includes(query)) best = Math.max(best, 1);
  }
  return best;
}

/** The places that answer `query`, best first; every place when nothing is typed yet. */
export function matchTeleport(query: string, places: readonly TeleportPlace[]): TeleportPlace[] {
  let wanted = plain(query);
  while (filler.test(wanted)) wanted = wanted.replace(filler, "");
  if (!wanted) return [...places];
  return places
    .map((place, index) => ({ place, index, score: score(place, wanted) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.place);
}

/** A `/` command typed in the chat box. */
export type GameCommand =
  | { name: "teleport"; query: string }
  | { name: "sit" }
  | { name: "page"; page: SeatPage }
  | { name: "settings" }
  | { name: "emote"; emote: StudioEmote | null; query: string };

const isEmote = (word: string): word is StudioEmote =>
  (studioEmoteNames as readonly string[]).includes(word);

/**
 * Reads a `/` command out of what was typed; null when it is a message, not a command (anything
 * not starting with `/`, or a `/` word the building doesn't know).
 */
export function parseGameCommand(text: string): GameCommand | null {
  const match = /^\/(\S+)(?:\s+(.*))?$/s.exec(text.trim());
  if (!match) return null;
  const word = match[1]!.toLowerCase();
  const rest = (match[2] ?? "").trim();
  if (word === "teleport" || word === "tp" || word === "go")
    return { name: "teleport", query: rest };
  if (word === "sit") return { name: "sit" };
  if (word === "settings" || word === "prefs") return { name: "settings" };
  const page = pageCommands.find((item) => item.words.includes(word));
  if (page) return { name: "page", page: page.page };
  if (word === "e" || word === "emote") {
    const emote = rest.toLowerCase();
    return { name: "emote", emote: isEmote(emote) ? emote : null, query: rest };
  }
  if (isEmote(word)) return { name: "emote", emote: word, query: word };
  return null;
}

/** The commands, as the chat box suggests them while a `/` is typed; `page` for a page's own. */
export const gameCommandHelp: readonly { command: string; detail: string; page?: SeatPage }[] = [
  { command: "/teleport", detail: "Go to a room, a page, an agent, a teammate or a building" },
  { command: "/sit", detail: "Sit down at your desk" },
  ...pageCommands.map(({ page, command }) => ({
    command,
    detail: `Open ${pages.find((item) => item.page === page)?.label ?? command.slice(1)} at ${
      seatForPage(page) === "library" ? "the library" : "your desk"
    }`,
    page,
  })),
  { command: "/settings", detail: "Open settings" },
  { command: "/e", detail: `Act out an emote: ${studioEmoteNames.join(", ")}` },
];
