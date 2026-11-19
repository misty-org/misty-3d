import { AppWindow, Gamepad2, type LucideIcon } from "lucide-react";
import { useGameMode, type GameMode } from "./gameMode";
import { useShortcutLabel } from "@/features/shortcuts";
import { Segment, SegmentTrack, Tooltip } from "@/shared/ui";

const modes: readonly { id: GameMode; label: string; icon: LucideIcon }[] = [
  { id: "classic", label: "Classic", icon: AppWindow },
  { id: "game", label: "Game", icon: Gamepad2 },
];

/**
 * The switch between Classic and Game, as Claude's Chat and Code switch is: two choices side by
 * side, the current one lifted out of its track. Compact, in the sidebar's head, it shows only the
 * two icons, each named by its tooltip.
 */
export function GameModeSwitch({ compact = false }: { compact?: boolean }) {
  const mode = useGameMode((state) => state.mode);
  const shortcut = useShortcutLabel("app.toggle_game_mode");
  return (
    <SegmentTrack role="radiogroup" aria-label="Mode" data-tour="game-switch">
      {modes.map(({ id, label, icon: Icon }) => (
        <Tooltip key={id} content={compact ? label : ""} shortcut={id === mode ? "" : shortcut}>
          <Segment
            type="button"
            role="radio"
            aria-checked={mode === id}
            aria-label={compact ? label : undefined}
            iconOnly={compact}
            onClick={() => useGameMode.getState().setMode(id)}
          >
            <Icon aria-hidden="true" />
            {compact ? null : label}
          </Segment>
        </Tooltip>
      ))}
    </SegmentTrack>
  );
}
