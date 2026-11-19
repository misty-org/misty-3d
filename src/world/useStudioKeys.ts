import { useEffect, useRef } from "react";
import { hotbarSlotForKey, type HotbarSlotId } from "./GameHotbar";
import { typingIn } from "./studio/keys";
import { emotes } from "./StudioHotbar";
import type { StudioEmote } from "./studioOrders";

/** What the building's keys do, read fresh on every press. */
export interface StudioKeys {
  /** Off while the person sits at their desk: every key is the pages' on its monitor. */
  enabled: boolean;
  /** The emote picker is open: its number keys pick an emote. */
  emoteOpen: boolean;
  /** The hotbar is showing, so the number keys are its slots. */
  hotbar: boolean;
  emote(kind: StudioEmote): void;
  closeEmotes(): void;
  slot(id: HotbarSlotId): void;
  /** L: the building's level and today's quests. */
  level(): void;
  /** N: name tags over the figures. */
  names(): void;
  /** F: the building fills the screen. */
  fullscreen(): void;
  /** B: rebuild the room. */
  build(): void;
  /** Escape, once nothing else took it: lets go of one thing, most recent first. */
  escape(): boolean;
}

/**
 * The building's keys, as a game's: 1 to 9 the hotbar (or, with the emote picker open, its
 * emotes), B to build, L the level, N the name tags, F the full screen, and Escape to back out of
 * whatever was last opened. Nothing is taken while the person types, or with a modifier held, so
 * the app's own shortcuts still work. Added once; the handler reads `keys` as it is now.
 */
export function useStudioKeys(keys: StudioKeys) {
  const latest = useRef(keys);
  latest.current = keys;
  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      if (typingIn(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const now = latest.current;
      if (!now.enabled) return;
      const act = (run: () => void) => {
        event.preventDefault();
        run();
      };
      if (now.emoteOpen) {
        const index = Number(event.code.replace("Digit", "")) - 1;
        const chosen = event.code.startsWith("Digit") ? emotes[index] : undefined;
        if (chosen) return act(() => now.emote(chosen.emote));
        if (event.code === "Escape") return act(now.closeEmotes);
      }
      const slot = now.hotbar ? hotbarSlotForKey(event.code) : undefined;
      if (slot) return act(() => now.slot(slot));
      const byKey: Record<string, () => void> = {
        KeyB: now.build,
        KeyL: now.level,
        KeyN: now.names,
        KeyF: now.fullscreen,
      };
      const run = byKey[event.code];
      if (run) return act(run);
      if (event.code === "Escape" && now.escape()) event.preventDefault();
    };
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  }, []);
}
