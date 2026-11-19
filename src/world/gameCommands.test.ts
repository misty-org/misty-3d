import { describe, expect, it } from "vitest";
import { matchTeleport, parseGameCommand, seatForPage, teleportPlaces } from "./gameCommands";

const places = teleportPlaces({
  figures: [
    { id: "agent-1", name: "Juno", detail: "Your agent" },
    { id: "member:u2", name: "Sam", detail: "In the Lounge" },
  ],
  buildings: [{ id: "space-2", name: "Design team" }],
});
const first = (query: string) => matchTeleport(query, places)[0]?.target;

describe("game commands", () => {
  it("reads /teleport and its short forms, and leaves messages alone", () => {
    expect(parseGameCommand("/teleport library")).toEqual({ name: "teleport", query: "library" });
    expect(parseGameCommand("/tp   meeting room ")).toEqual({
      name: "teleport",
      query: "meeting room",
    });
    expect(parseGameCommand("/teleport")).toEqual({ name: "teleport", query: "" });
    expect(parseGameCommand("@Juno look at /teleport")).toBeNull();
    expect(parseGameCommand("hello")).toBeNull();
    expect(parseGameCommand("/nonsense here")).toBeNull();
  });

  it("reads emotes the way games do, with /e or the emote's own name", () => {
    expect(parseGameCommand("/e dance")).toEqual({ name: "emote", emote: "dance", query: "dance" });
    expect(parseGameCommand("/wave")).toEqual({ name: "emote", emote: "wave", query: "wave" });
    expect(parseGameCommand("/e moonwalk")).toEqual({
      name: "emote",
      emote: null,
      query: "moonwalk",
    });
    expect(parseGameCommand("/sit")).toEqual({ name: "sit" });
  });

  it("opens a page by its own command, and settings", () => {
    expect(parseGameCommand("/code")).toEqual({ name: "page", page: "code" });
    expect(parseGameCommand("/Calendar")).toEqual({ name: "page", page: "calendar" });
    expect(parseGameCommand("/docs")).toEqual({ name: "page", page: "notes" });
    expect(parseGameCommand("/new")).toEqual({ name: "page", page: "chats" });
    expect(parseGameCommand("/chat")).toEqual({ name: "page", page: "chat" });
    expect(parseGameCommand("/media")).toEqual({ name: "page", page: "files" });
    expect(parseGameCommand("/settings")).toEqual({ name: "settings" });
    // Emotes keep their own words.
    expect(parseGameCommand("/point")).toEqual({ name: "emote", emote: "point", query: "point" });
  });

  it("finds rooms by their names and the words people use for them", () => {
    expect(first("library")).toEqual({ kind: "room", room: "library" });
    expect(first("meeting")).toEqual({ kind: "room", room: "meeting" });
    expect(first("to the lounge")).toEqual({ kind: "room", room: "lounge" });
    expect(first("exit")).toEqual({ kind: "room", room: "door" });
    expect(first("my desk")).toEqual({ kind: "room", room: "desk" });
  });

  it("sits straight down on a page: the Lab at the library, the rest at the person's desk", () => {
    expect(first("code")).toEqual({ kind: "seat", place: "desk", page: "code" });
    expect(first("calendar")).toEqual({ kind: "seat", place: "desk", page: "calendar" });
    expect(first("lab")).toEqual({ kind: "seat", place: "library", page: "lab" });
    expect(seatForPage("files")).toBe("library");
    expect(seatForPage("planner")).toBe("desk");
  });

  it("goes to agents, teammates and other buildings by name, from the start of any word", () => {
    expect(first("juno")).toEqual({ kind: "figure", id: "agent-1" });
    expect(first("Sa")).toEqual({ kind: "figure", id: "member:u2" });
    expect(first("design")).toEqual({ kind: "building", id: "space-2" });
    expect(first("team")).toEqual({ kind: "room", room: "office" });
  });

  it("ranks whole names over beginnings, and offers everything before anything is typed", () => {
    expect(matchTeleport("", places)).toHaveLength(places.length);
    expect(matchTeleport("zzz", places)).toEqual([]);
    // "chat" is the Space's chat by name; "chats" the person's own.
    expect(first("chat")).toEqual({ kind: "seat", place: "desk", page: "chat" });
    expect(first("chats")).toEqual({ kind: "seat", place: "desk", page: "chats" });
  });
});
