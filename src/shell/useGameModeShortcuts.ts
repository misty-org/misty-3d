import { useCallback } from "react";
import { inGameWorld, useGameMode } from "./gameMode";
import { useShortcutHandler } from "@/features/shortcuts";

const seated = () => {
  const state = useGameMode.getState();
  return state.mode === "game" && Boolean(state.seat);
};

/**
 * Classic and Game, from the keyboard: the mode switch's shortcut, and Stand up to get up from a
 * computer in Game mode (offered only while sitting at one). Returns whether the building is on
 * screen.
 */
export function useGameModeShortcuts(): boolean {
  const inWorld = useGameMode(inGameWorld);
  useShortcutHandler(
    "app.toggle_game_mode",
    useCallback(() => useGameMode.getState().toggle(), []),
  );
  useShortcutHandler(
    "game.stand_up",
    useCallback(() => useGameMode.getState().standUp(), []),
    seated,
  );
  return inWorld;
}
