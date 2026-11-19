import { useGameMode, type GameMode } from "../shell/gameMode";
import { GamePreview } from "../world/GamePreview";
import { Surface, Text } from "@/shared/ui";
import { PreviewChoice } from "@/features/onboarding/setup/PreviewChoice";

/** A tiny window: the sidebar of places and chats beside a conversation. */
function ClassicPreview() {
  return (
    <Surface
      tone="card"
      edge="hairline"
      radius="md"
      className="flex aspect-[16/10] w-full gap-[4%] overflow-hidden p-[5%]"
      aria-hidden="true"
    >
      <div className="flex w-[26%] flex-col gap-[6%]">
        <Surface tone="active" className="h-[10%] rounded-sm" />
        <Surface tone="well" className="h-[10%] rounded-sm" />
        <Surface tone="well" className="h-[10%] rounded-sm" />
        <Surface tone="well" className="h-[10%] rounded-sm" />
      </div>
      <Surface
        tone="page"
        edge="hairline"
        className="flex flex-1 flex-col gap-[7%] rounded-sm p-[7%]"
      >
        <Surface tone="well" className="h-[9%] w-2/3 self-end rounded-sm" />
        <Surface tone="well" className="h-[9%] w-3/4 rounded-sm" />
        <Surface tone="well" className="h-[9%] w-1/2 rounded-sm" />
        <Surface tone="well" className="mt-auto h-[14%] w-full rounded-md" />
      </Surface>
    </Surface>
  );
}

const choices: { mode: GameMode; label: string; line: string }[] = [
  { mode: "classic", label: "Classic", line: "Pages, chats and a sidebar, as you know them." },
  {
    mode: "game",
    label: "Game",
    line: "Walk around a building where your agents work. Sit at your desk for the real pages.",
  },
];

/**
 * Setup's choice of how to work: Classic, the app as pages, or Game, the same work as a building
 * to walk around in, each shown as it looks. The choice takes effect at once and can be changed
 * any time from the switch at the top of the window.
 */
export function ModeStep() {
  const mode = useGameMode((state) => state.mode);
  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label="How you work" className="grid grid-cols-2 gap-3">
        {choices.map((choice) => (
          <PreviewChoice
            key={choice.mode}
            label={choice.label}
            selected={mode === choice.mode}
            onSelect={() => useGameMode.getState().setMode(choice.mode)}
          >
            {choice.mode === "game" ? <GamePreview /> : <ClassicPreview />}
          </PreviewChoice>
        ))}
      </div>
      <Text size="body" tone="muted" wrap>
        {choices.find((choice) => choice.mode === mode)?.line} You can switch any time from the top
        of the window.
      </Text>
    </div>
  );
}
