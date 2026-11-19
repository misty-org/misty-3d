import type { FigureColors } from "./figure/CharacterModel";
import type { ComputerView } from "./Walk";

/** What Game mode tells the person's walk, beyond walking itself. */
export interface WalkOptions {
  /** Which building this is, so the person comes back to where they stood in it. */
  memory: string;
  teleport?: { x: number; z: number; yaw: number; at: number } | null;
  /** Sitting down at a computer: the camera moves into its screen, then `onSat` is told. */
  sitting?: ComputerView | null;
  onSat?(): void;
  /** Back from a computer: the camera starts in its screen and moves out to the person. */
  risingFrom?: ComputerView | null;
  /** Who the person is, which settles their character until they pick one. */
  who: string;
  /** How the person's own figure looks, as they dressed it. */
  look?: { model?: string } & FigureColors;
}
