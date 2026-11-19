import { describe, expect, it } from "vitest";
import { figurePose, type PoseInput } from "./figurePose";

const base: PoseInput = {
  doing: "relax",
  emote: null,
  cheer: null,
  seated: false,
  slumped: false,
  time: 0,
};

describe("a figure's moves", () => {
  it("does its work's move: typing, a raised hand, scratching its head", () => {
    expect(figurePose({ ...base, doing: "type", seated: true }).upper).toBe("type");
    expect(figurePose({ ...base, doing: "hand", seated: true }).upper).toBe("hand");
    expect(figurePose({ ...base, doing: "puzzled", seated: true }).upper).toBe("puzzled");
    expect(figurePose({ ...base, doing: "walk" }).upper).toBe("idle");
  });

  it("acts out an emote over its work, and a cheer jumps for joy only standing", () => {
    expect(figurePose({ ...base, doing: "type", emote: { kind: "clap", age: 0.2 } }).upper).toBe(
      "clap",
    );
    const standing = figurePose({ ...base, emote: { kind: "cheer", age: 0.2 } });
    expect(standing).toMatchObject({ victory: true, upper: "idle" });
    const sitting = figurePose({ ...base, seated: true, emote: { kind: "cheer", age: 0.2 } });
    expect(sitting).toMatchObject({ victory: false, upper: "cheer" });
  });

  it("cheers a finished run the same way", () => {
    expect(figurePose({ ...base, cheer: { age: 0.5 } }).victory).toBe(true);
    expect(figurePose({ ...base, seated: true, cheer: { age: 0.5 } }).upper).toBe("cheer");
  });

  it("dances with its hips swaying and a bounce, but not in a seat", () => {
    const dancing = figurePose({ ...base, emote: { kind: "dance", age: 0.3 } });
    expect(dancing.upper).toBe("dance");
    expect(dancing.sway).not.toBe(0);
    expect(dancing.bounce).toBeGreaterThan(0);
    const seated = figurePose({ ...base, seated: true, emote: { kind: "dance", age: 0.3 } });
    expect(seated.sway).toBe(0);
    expect(seated.bounce).toBe(0);
  });

  it("tilts its head to listen, and hangs it after a failed run with nothing to puzzle at", () => {
    expect(figurePose({ ...base, doing: "listen" }).look.tip).toBeGreaterThan(0);
    expect(figurePose({ ...base, slumped: true }).look.nod).toBeGreaterThan(0.3);
    expect(figurePose({ ...base, doing: "puzzled", slumped: true }).look.nod).toBe(0);
  });
});
