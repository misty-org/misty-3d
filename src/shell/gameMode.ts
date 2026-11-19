import { create } from "zustand";
import { createDeviceSetting } from "@/shared/lib/deviceSetting";

/**
 * The two ways to work in Misty: Classic, the app as pages, and Game, the same agents and work as
 * a building of rooms to walk around in. Both show the same chats, agents and Spaces.
 */
export type GameMode = "classic" | "game";

/**
 * Where the person sat down in Game mode, at a computer that opens a real page full size: their
 * own desk (their chats, Code, Calendar) or a reading desk in the library (the Lab).
 */
export interface GameSeat {
  place: "desk" | "library";
  /** The page the computer opened, when it opened a particular one. */
  route?: string;
}

export const isGameMode = (value: unknown): value is GameMode =>
  value === "classic" || value === "game";

/** Kept for this device in `misty.db`. Classic is the default: Game is chosen, never assumed. */
const savedMode = createDeviceSetting<GameMode>({
  scope: "game-mode",
  defaults: "classic",
  normalize: (stored) => (isGameMode(stored) ? stored : "classic"),
});

interface GameModeState {
  mode: GameMode;
  /** Sitting at a computer in Game mode: the real pages show; null while walking the building. */
  seat: GameSeat | null;
  /** Counts the times the person got up from a computer, so the building can start afresh. */
  stood: number;
  /** Switches mode; Classic leaves any seat, keeping the page it showed. */
  setMode(mode: GameMode): void;
  toggle(): void;
  /** Sits down at a computer, in Game mode. */
  sitDown(seat: GameSeat): void;
  /** Gets up from the computer, back into the room. */
  standUp(): void;
}

/**
 * Which mode this window is in, and whether the person is sitting at a computer. The choice of
 * mode is saved for the next launch; sitting down is only for this window's session.
 */
export const useGameMode = create<GameModeState>((set, get) => ({
  mode: savedMode.getState().value,
  seat: null,
  stood: 0,
  setMode: (mode) => {
    restored = true;
    if (mode === get().mode) return;
    set({ mode, seat: null, stood: get().stood + (get().seat ? 1 : 0) });
    savedMode.getState().set(mode);
  },
  toggle: () => get().setMode(get().mode === "game" ? "classic" : "game"),
  sitDown: (seat) => {
    if (get().mode !== "game") return;
    set({ seat });
  },
  standUp: () => {
    if (get().seat) set({ seat: null, stood: get().stood + 1 });
  },
}));

// Only the first answer from misty.db applies (the launch), as with focus mode: switching modes in
// one window never pulls another window out from under its person.
let restored = false;
savedMode.subscribe(({ value, loaded }) => {
  if (!loaded || restored) return;
  restored = true;
  useGameMode.setState({ mode: value, seat: null });
});

/** Whether the building is on screen: Game mode, not sitting at a computer. */
export const inGameWorld = (state: Pick<GameModeState, "mode" | "seat">): boolean =>
  state.mode === "game" && !state.seat;

/** Whether the person sits at a computer in Game mode: the pages show on its monitor. */
export const atGameDesk = (state: Pick<GameModeState, "mode" | "seat">): boolean =>
  state.mode === "game" && Boolean(state.seat);
