import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useGameMode } from "./gameMode";
import { GameModeSwitch } from "./GameModeSwitch";

beforeEach(() => useGameMode.setState({ mode: "classic", seat: null }));
afterEach(cleanup);

it("switches between Classic and Game, with the current one checked", () => {
  render(<GameModeSwitch />);
  const classic = screen.getByRole("radio", { name: /Classic/ });
  const game = screen.getByRole("radio", { name: /Game/ });
  expect(classic.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(game);
  expect(useGameMode.getState().mode).toBe("game");
  expect(game.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(classic);
  expect(useGameMode.getState().mode).toBe("classic");
});

it("names its icons when compact, as the sidebar's head shows it", () => {
  render(<GameModeSwitch compact />);
  expect(screen.getByRole("radiogroup", { name: "Mode" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Classic" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Game" })).toBeTruthy();
});
