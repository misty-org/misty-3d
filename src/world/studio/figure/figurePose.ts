import type { StudioEmote } from "../../studioOrders";
import type { Activity } from "../behaviour";
import type { UpperMove } from "./FigureAnimator";

/** What a figure is doing at its place, or on its way there, or stopped to listen. */
export type Doing = Activity | "listen" | "walk";

/** Each thing a figure does at its place, as its arms and head do it. */
const doingMove: Record<Doing, UpperMove> = {
  type: "type",
  talk: "talk",
  wave: "wave",
  relax: "idle",
  play: "play",
  hand: "hand",
  puzzled: "puzzled",
  listen: "idle",
  walk: "idle",
};

/** Each emote, as the arms act it out. */
const emoteMove: Record<StudioEmote, UpperMove> = {
  wave: "wave",
  cheer: "cheer",
  dance: "dance",
  clap: "clap",
  think: "think",
  point: "point",
};

/** What decides a figure's moves this frame. */
export interface PoseInput {
  doing: Doing;
  /** Something it was asked to act out, while it still is. */
  emote: { kind: StudioEmote; age: number } | null;
  /** Cheering a run of its that just finished, and for how long so far. */
  cheer: { age: number } | null;
  /** In a seat, or on its way into one. */
  seated: boolean;
  /** A run of its failed and it has nowhere to puzzle over it: it hangs its head. */
  slumped: boolean;
  /** Seconds, for the moves that drift with time. */
  time: number;
}

/** What the figure's body does: the arms' move, a full-body cheer, and the hips and head. */
export interface PoseOutput {
  upper: UpperMove;
  victory: boolean;
  /** Hips swaying side to side, in radians. */
  sway: number;
  /** How far it is off the ground for a hop or a bounce, in scene units. */
  bounce: number;
  /** The head's own turn, nod and tip, before it looks at anyone. */
  look: { turn: number; nod: number; tip: number };
}

/**
 * A figure's moves for what it is doing: an emote or a cheer comes first, acted out standing (a
 * cheer jumps for joy) or in a seat (the arms alone); otherwise its work's move, a listening tilt
 * of the head, or a slow look about while it rests.
 */
export function figurePose(input: PoseInput): PoseOutput {
  const { doing, emote, cheer, seated, time } = input;
  const look = { turn: 0, nod: 0, tip: 0 };
  if (cheer) {
    return {
      upper: seated ? "cheer" : "idle",
      victory: !seated,
      sway: 0,
      bounce: 0,
      look,
    };
  }
  if (emote) {
    const dancing = emote.kind === "dance" && !seated;
    const standingCheer = emote.kind === "cheer" && !seated;
    return {
      upper: standingCheer ? "idle" : emoteMove[emote.kind],
      victory: standingCheer,
      sway: dancing ? Math.sin(emote.age * 6) * 0.14 : 0,
      bounce: dancing ? Math.abs(Math.sin(emote.age * 6)) * 0.06 : 0,
      look,
    };
  }
  if (doing === "relax" && !seated) look.turn = Math.sin(time * 0.45) * 0.45;
  if (doing === "listen") {
    look.nod = Math.sin(time * 1.6) * 0.04;
    look.tip = 0.07;
  }
  if (input.slumped && doing !== "puzzled" && doing !== "type") look.nod = 0.42;
  return { upper: doingMove[doing], victory: false, sway: 0, bounce: 0, look };
}
