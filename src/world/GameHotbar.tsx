import { Gamepad2, Hammer, Smile, Tag, type LucideIcon } from "lucide-react";
import { appIcons, cn, SceneSlot, Surface, type SceneTint } from "@/shared/ui";
import { furnitureIcons } from "./furnitureIcons";

/** What a hotbar slot does: act something out, go somewhere, or open one of the building's tools. */
export type HotbarSlotId =
  "emote" | "desk" | "meeting" | "library" | "lounge" | "games" | "music" | "build" | "names";

interface HotbarSlot {
  id: HotbarSlotId;
  label: string;
  icon: LucideIcon;
  tint: SceneTint;
}

/**
 * The hotbar, keys 1 to 9 as in a game: emote first, then the places a key away (sitting down at
 * the person's desk, the meeting room, the library and the lounge), then the building's tools. Each
 * slot keeps one tint, the tint its subject wears everywhere in the HUD.
 */
export const hotbarSlots: readonly HotbarSlot[] = [
  { id: "emote", label: "Emote", icon: Smile, tint: "yellow" },
  { id: "desk", label: "Desk", icon: furnitureIcons.workstation, tint: "blue" },
  { id: "meeting", label: "Meeting", icon: furnitureIcons.table, tint: "green" },
  { id: "library", label: "Library", icon: furnitureIcons["reading-desk"], tint: "sand" },
  { id: "lounge", label: "Lounge", icon: furnitureIcons.sofa, tint: "orange" },
  { id: "games", label: "Games", icon: Gamepad2, tint: "red" },
  { id: "music", label: "Music", icon: appIcons.music, tint: "purple" },
  { id: "build", label: "Build", icon: Hammer, tint: "orange" },
  { id: "names", label: "Names", icon: Tag, tint: "blue" },
];

/** The slot a number key presses: Digit1 to Digit9. */
export function hotbarSlotForKey(code: string): HotbarSlotId | undefined {
  const index = /^Digit([1-9])$/.exec(code)?.[1];
  return index ? hotbarSlots[Number(index) - 1]?.id : undefined;
}

/** What each slot says for itself, for a screen reader: more than its one word. */
const fullNames: Record<HotbarSlotId, string> = {
  emote: "Emotes",
  desk: "Sit down at your desk",
  meeting: "Go to the meeting room",
  library: "Go to the library",
  lounge: "Go to the lounge",
  games: "Play the Space's games",
  music: "Music",
  build: "Build",
  names: "Name tags",
};

/**
 * Game mode's hotbar, along the bottom in the middle: nine slots, each with its number key in the
 * corner. It rests small (just the glyphs) and spells the words out while the pointer is over it.
 */
export function GameHotbar(props: {
  /** Which slots are lit: the emote wheel open, the music playing, name tags showing. */
  lit: ReadonlySet<HotbarSlotId>;
  onSlot(id: HotbarSlotId): void;
  compact: boolean;
  onHover(open: boolean): void;
}) {
  return (
    <Surface
      tone="scene-panel"
      radius="xl"
      className={cn("flex max-w-full p-1", "max-[792px]:group-data-[talking]/studio:hidden")}
      data-tour="studio-hotbar"
      onPointerEnter={() => props.onHover(true)}
      onPointerLeave={() => props.onHover(false)}
    >
      <div role="toolbar" aria-label="Hotbar" className="flex items-center gap-0.5">
        {hotbarSlots.map((slot, index) => (
          <SceneSlot
            key={slot.id}
            icon={<slot.icon aria-hidden="true" />}
            compact={props.compact}
            keyName={String(index + 1)}
            tint={slot.tint}
            aria-label={fullNames[slot.id]}
            aria-expanded={slot.id === "emote" ? props.lit.has("emote") : undefined}
            selected={props.lit.has(slot.id)}
            onClick={() => props.onSlot(slot.id)}
          >
            {slot.label}
          </SceneSlot>
        ))}
      </div>
    </Surface>
  );
}
