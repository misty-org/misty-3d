import { beforeEach, describe, expect, it } from "vitest";
import { inGameWorld, useGameMode } from "./gameMode";

beforeEach(() => useGameMode.setState({ mode: "classic", seat: null }));

describe("Classic and Game", () => {
  it("starts in Classic, and only Game has a building to be in", () => {
    expect(useGameMode.getState().mode).toBe("classic");
    expect(inGameWorld(useGameMode.getState())).toBe(false);
    useGameMode.getState().toggle();
    expect(useGameMode.getState().mode).toBe("game");
    expect(inGameWorld(useGameMode.getState())).toBe(true);
  });

  it("sits down only in Game mode, which takes the building away until standing up", () => {
    useGameMode.getState().sitDown({ place: "desk" });
    expect(useGameMode.getState().seat).toBeNull();
    useGameMode.getState().setMode("game");
    useGameMode.getState().sitDown({ place: "desk", route: "/agents?view=code" });
    expect(useGameMode.getState().seat).toEqual({ place: "desk", route: "/agents?view=code" });
    expect(inGameWorld(useGameMode.getState())).toBe(false);
    useGameMode.getState().standUp();
    expect(inGameWorld(useGameMode.getState())).toBe(true);
  });

  it("leaves the seat behind when switching to Classic, keeping the page it showed", () => {
    useGameMode.getState().setMode("game");
    useGameMode.getState().sitDown({ place: "library" });
    useGameMode.getState().setMode("classic");
    expect(useGameMode.getState()).toMatchObject({ mode: "classic", seat: null });
  });
});
