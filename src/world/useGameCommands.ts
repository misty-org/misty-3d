import { useMemo } from "react";
import {
  CodeXml,
  DoorOpen,
  MapPin,
  Navigation,
  Settings,
  Smile,
  SquarePen,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { spaceIcons } from "@/shared/ui";
import {
  gameCommandHelp,
  matchTeleport,
  parseGameCommand,
  teleportPlaces,
  type SeatPage,
  type TeleportPlace,
  type TeleportTarget,
} from "./gameCommands";
import type { RoomId } from "./studio/building";
import type { Building } from "./BuildingsPanel";
import { furnitureIcons } from "./furnitureIcons";
import type { ChatCommands } from "./StudioBox";
import { emotes } from "./StudioHotbar";
import type { StudioEmote } from "./studioOrders";
import { placeWords, type TeamMember } from "./teamMembers";
import type { StudioAgent } from "@/features/agents/now/useStudioAgents";

/** The most places `/teleport` suggests at once. */
const MOST_SUGGESTED = 6;

/** Each room's own glyph: the piece it is built round. */
const roomIcons: Record<RoomId, LucideIcon> = {
  desk: furnitureIcons.workstation,
  office: furnitureIcons.desk,
  meeting: furnitureIcons.table,
  lounge: furnitureIcons.sofa,
  library: furnitureIcons["reading-desk"],
  arcade: furnitureIcons.arcade,
  door: DoorOpen,
};

/** Each page's own glyph, as the app shows that page everywhere. */
const pageIcons: Record<SeatPage, LucideIcon> = {
  code: CodeXml,
  chats: SquarePen,
  calendar: spaceIcons.calendar,
  planner: spaceIcons.planner,
  notes: spaceIcons.docs,
  slides: spaceIcons.slides,
  data: spaceIcons.data,
  drawings: spaceIcons.whiteboards,
  chat: spaceIcons.chat,
  lab: spaceIcons.lab,
  files: spaceIcons.media,
};

/** What a place `/teleport` offers looks like in the list: its own glyph. */
function placeIcon(place: TeleportPlace): LucideIcon {
  const { target } = place;
  if (target.kind === "room") return roomIcons[target.room];
  if (target.kind === "seat") return pageIcons[target.page];
  if (target.kind === "building") return spaceIcons.space;
  return UserRound;
}

/** Each command's glyph in the list. */
const commandIcons: Record<string, LucideIcon> = {
  "/teleport": Navigation,
  "/sit": furnitureIcons.workstation,
  "/settings": Settings,
  "/e": Smile,
};

/**
 * The building's chat box commands: `/teleport` to any room, page, agent, teammate or building,
 * `/sit` at the person's desk, a page's own word (`/code`, `/calendar`…) to sit down on it,
 * `/settings`, and `/e` to act out an emote, with what is typed so far completed from where there
 * is to go.
 */
export function useGameCommands(input: {
  /** The person's agents, by the names the building gives them. */
  agents: readonly StudioAgent[];
  names: Map<string, string>;
  /** The Space's other members here now. */
  members: readonly TeamMember[];
  buildings: readonly Building[];
  goTo(target: TeleportTarget): void;
  sit(): void;
  /** Sits down on a page at its computer, or opens it on the one the person sits at. */
  openPage(page: SeatPage): void;
  settings(): void;
  emote(kind: StudioEmote): void;
}): ChatCommands {
  const { agents, names, members, buildings, goTo, sit, openPage, settings, emote } = input;
  const figures = useMemo(
    () => [
      ...agents.map(({ agent }) => ({
        id: agent.id,
        name: names.get(agent.id) ?? agent.name,
        detail: "Your agent",
      })),
      ...members
        .filter((member) => member.place === "studio")
        .map((member) => ({
          id: `member:${member.userId}`,
          name: member.name,
          detail: placeWords(member),
        })),
    ],
    [agents, names, members],
  );
  const places = useMemo(
    () =>
      teleportPlaces({
        figures,
        buildings: buildings.filter((building) => !building.current),
      }),
    [figures, buildings],
  );
  return useMemo<ChatCommands>(
    () => ({
      run(text) {
        const command = parseGameCommand(text);
        if (!command) return undefined;
        if (command.name === "sit") {
          sit();
          return "";
        }
        if (command.name === "page") {
          openPage(command.page);
          return "";
        }
        if (command.name === "settings") {
          settings();
          return "";
        }
        if (command.name === "emote") {
          if (!command.emote) return `Try ${emotes.map((item) => `/e ${item.emote}`).join(", ")}.`;
          emote(command.emote);
          return "";
        }
        if (!command.query) return "Say where after /teleport, such as /teleport library.";
        const found = matchTeleport(command.query, places)[0];
        if (!found) return `Nowhere here is called “${command.query}”.`;
        goTo(found.target);
        return "";
      },
      suggest(text) {
        if (!text.startsWith("/")) return [];
        const command = parseGameCommand(text);
        if (command?.name === "teleport" && /\s/.test(text)) {
          return matchTeleport(command.query, places)
            .slice(0, MOST_SUGGESTED)
            .map((place) => ({
              key: place.key,
              label: place.label,
              detail: place.detail,
              icon: placeIcon(place),
              text: `/teleport ${place.label}`,
            }));
        }
        if (command?.name === "emote" && /\s/.test(text)) {
          const typed = command.query.toLowerCase();
          return emotes
            .filter((item) => item.emote.startsWith(typed))
            .map((item) => ({
              key: item.emote,
              label: item.label,
              detail: "Emote",
              icon: item.icon,
              text: `/e ${item.emote}`,
            }));
        }
        const typed = text.trim().toLowerCase();
        return gameCommandHelp
          .filter((help) => help.command.startsWith(typed))
          .map((help) => ({
            key: help.command,
            label: help.command,
            detail: help.detail,
            icon: help.page ? pageIcons[help.page] : (commandIcons[help.command] ?? MapPin),
            text: `${help.command} `,
          }));
      },
    }),
    [places, goTo, sit, openPage, settings, emote],
  );
}
