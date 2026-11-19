import { AppWindow, DoorOpen, Maximize, Menu, PersonStanding, Users } from "lucide-react";
import { useGameMode } from "../shell/gameMode";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  MenuItem,
  MenuTrigger,
} from "@/shared/ui";

/**
 * Game mode's menu, the first button at the top left as in the games people know: the person's own
 * character and their agents, the other buildings, the full screen, and back to Classic. Build and
 * Settings sit beside it in the band, one press away.
 */
export function GameMenu(props: {
  /** Dresses the person's own figure. */
  onCharacter(): void;
  onTeamSettings(): void;
  onBuildings(): void;
  onFullscreen(): void;
  fullscreen: boolean;
  /** Sat at the desk: its keys are the pages', so no key is offered. */
  seated?: boolean;
}) {
  return (
    <DropdownMenu>
      <MenuTrigger label="Menu" iconOnly icon={Menu} />
      <DropdownMenuContent align="start" className="min-w-56">
        <MenuItem icon={PersonStanding} label="Your character" onSelect={props.onCharacter} />
        <MenuItem icon={Users} label="Your agents" onSelect={props.onTeamSettings} />
        <DropdownMenuSeparator />
        <MenuItem icon={DoorOpen} label="Other buildings" onSelect={props.onBuildings} />
        <MenuItem
          icon={Maximize}
          label={props.fullscreen ? "Leave full screen" : "Full screen"}
          shortcut={props.seated ? undefined : "F"}
          onSelect={props.onFullscreen}
        />
        <DropdownMenuSeparator />
        <MenuItem
          icon={AppWindow}
          label="Switch to Classic"
          onSelect={() => useGameMode.getState().setMode("classic")}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
