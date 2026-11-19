import { command } from "@/shared/shortcuts/factory";

/**
 * Classic and Game mode, and getting up from a computer in Game mode. The host adds these to its
 * shortcut registry beside focus mode (Misty's `shared/shortcuts/registry.ts`).
 */
export const gameModeCommands = [
  command("app.toggle_game_mode", "Switch between Classic and Game", {
    description: "Work in pages, or walk around a building where your agents work.",
    category: "View",
    aliases: ["game mode", "classic mode", "studio", "building", "play"],
    mac: "Cmd+Shift+G",
    windows: "Ctrl+Shift+G",
    allowInEditable: true,
  }),
  command("game.stand_up", "Stand up", {
    description: "Get up from the computer in Game mode, back into the room.",
    category: "View",
    aliases: ["leave the desk", "back to the room", "get up"],
    mac: "Cmd+Shift+U",
    windows: "Ctrl+Shift+U",
    allowInEditable: true,
  }),
];
