/**
 * misty-3d: Misty's Game mode, a building of rooms to walk around in where the person's agents
 * and teammates work, as one module. The host (Misty) mounts it at the points HOST.md lists; the
 * module reaches the host through its `@/…` imports.
 */

// The mode itself: Classic or Game, sitting at a computer, and the screen the pages lie on.
export {
  atGameDesk,
  inGameWorld,
  isGameMode,
  useGameMode,
  type GameMode,
  type GameSeat,
} from "./shell/gameMode";
export { deskGlass, deskScreenRect, type DeskScreenRect } from "./shell/deskScreen";

// What the host's window mounts.
export { GameWorld } from "./shell/GameWorld";
export { GameModeSwitch } from "./shell/GameModeSwitch";
export { useGameModeShortcuts } from "./shell/useGameModeShortcuts";
export { useDeskScreenBox } from "./shell/useDeskScreenBox";
export { gameModeCommands } from "./shell/shortcuts";

// Setup, settings and the tour.
export { ModeStep } from "./onboarding/ModeStep";
export { studioTour } from "./onboarding/studioTour";
export { StudioSettings } from "./world/studio/StudioSettings";
export { AgentVoiceField } from "./world/AgentVoiceField";

// Agents' figures: the tools a run calls to move theirs, and the orders the building acts out.
export { studioTools } from "./tools/studioTools";
export { followStudioOrders } from "./world/studioOrders";

// Teammates in rooms and their requests, which the host's Space presence fills in.
export { useStudioRequests, type StudioRequest } from "./world/teamMembers";
export type { SeatPage } from "./world/gameCommands";
